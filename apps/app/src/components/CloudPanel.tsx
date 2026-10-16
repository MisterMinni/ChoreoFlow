import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { commitProject, createHistory, type Project } from "@choreoflow/core";
import { getCloudService, getRepository } from "@choreoflow/data";
import { Button, Card, Field, Label } from "@choreoflow/ui";
import { saveProjectFile } from "../transfer";

type Account = { id: string; email?: string };
type Uploaded = { fingerprint: string; id: string; revision: number };
type SavedLink = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
};
type Props = { project: Project; onMessage: (text: string) => void };
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Die Cloud-Aktion konnte nicht abgeschlossen werden.";

export function CloudPanel({ project, onMessage }: Props) {
  const [configuration] = useState(() => {
    try {
      return { service: getCloudService(), error: "" };
    } catch (error) {
      return { service: null, error: errorText(error) };
    }
  });
  const service = configuration.service;
  const [account, setAccount] = useState<Account | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [freshLink, setFreshLink] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const fingerprint = useMemo(() => JSON.stringify(project), [project]);
  const userId = account?.id;

  useEffect(() => {
    mounted.current = true;
    if (!service)
      return () => {
        mounted.current = false;
      };
    let live = true;
    void service.client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setStatus(error.message);
        setAccount(data.session?.user ?? null);
      })
      .catch((error) => {
        if (live) setStatus(errorText(error));
      });
    const { data: subscription } = service.client.auth.onAuthStateChange(
      (_event, session) => {
        if (live) setAccount(session?.user ?? null);
      },
    );
    return () => {
      live = false;
      mounted.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [service]);

  useEffect(() => {
    let live = true;
    setUploaded(null);
    setLinks([]);
    setFreshLink(null);
    if (userId) {
      void getRepository({ identity: { kind: "cloud", userId } })
        .then(async (repository) => {
          const [saved, savedLinks] = await Promise.all([
            repository.getSetting<Uploaded>(`upload:${project.id}`),
            repository.getSetting<SavedLink[]>(`links:${project.id}`),
          ]);
          if (live) {
            setUploaded(saved ?? null);
            setLinks(savedLinks ?? []);
          }
        })
        .catch((error) => {
          if (live) setStatus(errorText(error));
        });
    }
    return () => {
      live = false;
    };
  }, [userId, project.id]);

  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      if (mounted.current) setStatus(errorText(error));
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function report(message: string) {
    if (mounted.current) {
      setStatus(message);
      onMessage(message);
    }
  }

  async function upload() {
    if (!service || !account) return;
    const snapshot = structuredClone(project);
    const sourceFingerprint = JSON.stringify(snapshot);
    const repository = await getRepository({
      identity: { kind: "cloud", userId: account.id },
    });
    const previous = await service.sync(repository);
    if (previous.conflicts.includes(snapshot.id))
      throw new Error(
        "Der Cloud-Stand wurde anderswo geändert. Deine lokale Arbeit bleibt erhalten. Exportiere die Projektdatei; ein Abgleich der Stände ist noch erforderlich.",
      );
    const existing = (await repository.list()).find(
      (item) => item.present.id === snapshot.id,
    );
    await repository.save(
      existing
        ? commitProject(existing, snapshot, account.id)
        : createHistory(snapshot),
    );
    const result = await service.sync(repository);
    if (result.conflicts.includes(snapshot.id))
      throw new Error(
        "Konflikt: Der Server hat einen neueren Stand. Die lokale Kopie und die ausstehenden Änderungen bleiben erhalten. Bitte eine Projektdatei exportieren.",
      );
    const state = await repository.load();
    if (state.outbox.some((item) => item.projectId === snapshot.id))
      throw new Error(
        "Dieser Stand ist noch nicht vollständig übertragen. Deine lokale Kopie bleibt erhalten.",
      );
    const id = state.cloudProjectIds[snapshot.id],
      revision = state.cloudRevisions[snapshot.id];
    if (!id || !revision)
      throw new Error("Der Serverstand konnte nicht bestätigt werden.");
    const record = { id, revision, fingerprint: sourceFingerprint };
    await repository.setSetting(`upload:${snapshot.id}`, record);
    if (mounted.current) setUploaded(record);
    report(
      `Im Testkonto gesichert · Serverstand ${revision}. Dein lokaler Editor bleibt unverändert.`,
    );
  }

  async function publish() {
    if (
      !service ||
      !account ||
      !uploaded ||
      uploaded.fingerprint !== fingerprint
    )
      return;
    if (Platform.OS !== "web" || typeof window === "undefined")
      throw new Error(
        "Freigabelinks werden derzeit in der Browserfassung erstellt.",
      );
    const repository = await getRepository({
      identity: { kind: "cloud", userId: account.id },
    });
    if (
      (await repository.pending()).some((item) => item.projectId === project.id)
    )
      throw new Error(
        "Bitte zuerst die ausstehenden Änderungen synchronisieren.",
      );
    const publication = (await service.publishProject(
      uploaded.id,
      uploaded.revision,
    )) as { id?: string };
    if (!publication?.id)
      throw new Error("Die Veröffentlichung wurde nicht bestätigt.");
    const link = (await service.createShareLink(publication.id)) as {
      id?: string;
      token?: string;
      expires_at?: string;
    };
    if (
      !link.id ||
      !link.token ||
      !link.expires_at ||
      !/^[0-9a-f]{64}$/.test(link.token)
    )
      throw new Error("Der Freigabelink wurde nicht bestätigt.");
    const record: SavedLink = {
      id: link.id,
      createdAt: new Date().toISOString(),
      expiresAt: link.expires_at,
      revoked: false,
    };
    const savedLinks =
      (await repository.getSetting<SavedLink[]>(`links:${project.id}`)) ?? [];
    const updatedLinks = [record, ...savedLinks];
    await repository.setSetting(`links:${project.id}`, updatedLinks);
    if (mounted.current) {
      setLinks(updatedLinks);
      setFreshLink({
        id: link.id,
        url: `${window.location.origin}/share#token=${link.token}`,
      });
    }
    report(
      "Probenstand veröffentlicht. Der Link zeigt diesen festen Stand, ohne private Notizen und ohne Musik.",
    );
  }

  async function revoke(link: SavedLink) {
    if (!service || !account) return;
    await service.revokeShareLink(link.id);
    const repository = await getRepository({
      identity: { kind: "cloud", userId: account.id },
    });
    const current =
      (await repository.getSetting<SavedLink[]>(`links:${project.id}`)) ?? [];
    const updated = current.map((item) =>
      item.id === link.id ? { ...item, revoked: true } : item,
    );
    await repository.setSetting(`links:${project.id}`, updated);
    if (mounted.current) {
      setLinks(updated);
      if (freshLink?.id === link.id) setFreshLink(null);
    }
    report("Freigabelink widerrufen. Neue Abrufe dieses Links sind gesperrt.");
  }

  if (!service)
    return (
      <Card>
        <Label bold>Cloud nicht eingerichtet</Label>
        <Label muted>
          {configuration.error ||
            "Die lokale Bearbeitung ist verfügbar. Für das Testkonto fehlen noch Projekt-URL und Publishable-Key in dieser Umgebung."}
        </Label>
        <Button onPress={() => void run(() => saveProjectFile(project))}>
          Projektdatei sichern
        </Button>
      </Card>
    );
  return (
    <View style={{ gap: 18 }}>
      <Label bold>Cloud-Testkonto</Label>
      <Label muted>
        Dein Entwurf bleibt lokal. Nur mit „Im Testkonto sichern“ überträgst du
        eine Kopie dieses Projekts.
      </Label>
      {!account ? (
        <>
          <Field
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={signup ? "new-password" : "current-password"}
          />
          <Button
            primary
            disabled={busy || !email.trim() || !password}
            onPress={() =>
              void run(async () => {
                if (signup) {
                  const result = await service.signUp(email, password);
                  report(
                    result.session
                      ? "Testkonto angemeldet."
                      : "Bitte die Bestätigungs-E-Mail öffnen und dich danach anmelden. Falls keine E-Mail ankommt, muss der Testversand eingerichtet werden.",
                  );
                } else {
                  await service.signIn(email, password);
                  report(
                    "Angemeldet. Die lokale Projektliste bleibt unverändert.",
                  );
                }
                if (mounted.current) setPassword("");
              })
            }
          >
            {busy
              ? "Bitte warten …"
              : signup
                ? "Testkonto erstellen"
                : "Anmelden"}
          </Button>
          <Button disabled={busy} onPress={() => setSignup((value) => !value)}>
            {signup
              ? "Ich habe bereits ein Konto"
              : "Neues Testkonto erstellen"}
          </Button>
        </>
      ) : (
        <>
          <Label size={13}>{account.email ?? "Angemeldetes Testkonto"}</Label>
          <Button
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await service.signOut();
                report("Abgemeldet. Deine lokalen Daten bleiben erhalten.");
              })
            }
          >
            Abmelden
          </Button>
          <Button primary disabled={busy} onPress={() => void run(upload)}>
            {busy ? "Bitte warten …" : "Im Testkonto sichern"}
          </Button>
          <Label muted size={12}>
            {uploaded?.fingerprint === fingerprint
              ? `Dieser lokale Stand ist als Serverstand ${uploaded.revision} gesichert.`
              : "Dieser lokale Stand muss vor der Veröffentlichung gesichert werden."}
          </Label>
          <Button
            disabled={
              busy ||
              !uploaded ||
              uploaded.fingerprint !== fingerprint ||
              Platform.OS !== "web"
            }
            onPress={() => void run(publish)}
          >
            Probenstand veröffentlichen
          </Button>
          <Label muted size={12}>
            Veröffentlicht ohne Musik und private Notizen. Spätere
            Entwurfsänderungen verändern den Link nicht. Ein neuer Link gilt 30
            Tage.
          </Label>
          {freshLink ? (
            <Card>
              <Label bold>Dein neuer Freigabelink</Label>
              <Field
                label="Freigabelink – jetzt kopieren"
                value={freshLink.url}
                editable={false}
                selectTextOnFocus
                multiline
              />
              <Button
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    if (
                      Platform.OS !== "web" ||
                      typeof navigator === "undefined" ||
                      !navigator.clipboard
                    )
                      throw new Error(
                        "Bitte den Link im Textfeld markieren und kopieren.",
                      );
                    await navigator.clipboard.writeText(freshLink.url);
                    report("Freigabelink kopiert.");
                  })
                }
              >
                Link kopieren
              </Button>
              <Label muted size={12}>
                Der geheime Link wird nur jetzt angezeigt. Auf localhost
                funktioniert er nur auf diesem Computer.
              </Label>
            </Card>
          ) : null}
          {links.length ? (
            <Label bold>Auf diesem Gerät erstellte Freigaben</Label>
          ) : null}
          {links.map((link) => (
            <Card key={link.id}>
              <Label size={13}>
                Stand vom {new Date(link.createdAt).toLocaleString("de-DE")}
              </Label>
              <Label muted size={12}>
                {link.revoked
                  ? "Widerrufen"
                  : `Gültig bis ${new Date(link.expiresAt).toLocaleDateString("de-DE")}`}
              </Label>
              <Button
                disabled={busy || link.revoked}
                onPress={() => void run(() => revoke(link))}
              >
                Link widerrufen
              </Button>
            </Card>
          ))}
        </>
      )}
      {status ? (
        <View accessibilityLiveRegion="polite">
          <Label style={{ flexShrink: 1 }}>{status}</Label>
        </View>
      ) : null}
      <Button
        disabled={busy}
        onPress={() => void run(() => saveProjectFile(project))}
      >
        Lokale Projektdatei exportieren
      </Button>
      <Label muted size={12}>
        Zusammenführen paralleler Cloud-Änderungen und native Freigabelinks sind
        noch in Arbeit. Konflikte werden angezeigt; lokale Entwürfe bleiben
        erhalten.
      </Label>
    </View>
  );
}
