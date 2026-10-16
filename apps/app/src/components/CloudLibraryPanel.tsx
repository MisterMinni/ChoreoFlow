import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { createHistory, createId } from "@choreoflow/core";
import {
  getCloudService,
  getRepository,
  TeamService,
  type CloudProject,
} from "@choreoflow/data";
import { Button, Card, Field, Label } from "@choreoflow/ui";
import { useApp } from "../state";
import { audioObjectPath } from "../audio/transfer";
import { cacheAudioBytes } from "../audio/storage";

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Die Cloud-Aktion ist fehlgeschlagen.";
type Account = { id: string; email?: string };
export function CloudLibraryPanel() {
  const app = useApp(),
    params = useLocalSearchParams<{ "#": string }>();
  const [service] = useState(() => {
    try {
      return getCloudService();
    } catch {
      return null;
    }
  });
  const [account, setAccount] = useState<Account | null>(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [rows, setRows] = useState<CloudProject[]>([]),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState("");
  const identity = useRef<string | undefined>(undefined),
    generation = useRef(0),
    running = useRef(false);
  const fragment = params["#"];
  useEffect(() => {
    if (fragment?.startsWith("invite=")) setInvite(fragment.slice(7));
  }, [fragment]);
  useEffect(() => {
    if (!service) return;
    const invalidate = () => { generation.current++; };
    let live = true,
      event = false;
    function update(next: Account | null) {
      if (!live) return;
      if (identity.current !== next?.id) {
        generation.current++;
        identity.current = next?.id;
        setRows([]);
        setPassword("");
        setStatus("");
      }
      setAccount(next);
    }
    const { data } = service.client.auth.onAuthStateChange(
      (_event, session) => {
        event = true;
        update(session?.user ?? null);
      },
    );
    void service.client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!live || event) return;
        update(data.session?.user ?? null);
        if (error) setStatus(error.message);
      })
      .catch((error) => {
        if (live && !event) setStatus(message(error));
      });
    return () => {
      live = false;
      invalidate();
      data.subscription.unsubscribe();
    };
  }, [service]);
  async function run(action: (guard: () => void) => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setStatus("");
    const scope = generation.current;
    const guard = () => {
      if (scope !== generation.current)
        throw new Error("Das Konto wurde gewechselt. Bitte erneut starten.");
    };
    try {
      await action(guard);
    } catch (error) {
      if (scope === generation.current) setStatus(message(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function refresh(guard: () => void) {
    if (!service || !account) return;
    const result = await service.listProjects(account.id);
    guard();
    setRows(result);
    setStatus(
      result.length
        ? `${result.length} Cloud-Projekt${result.length === 1 ? "" : "e"} verfügbar.`
        : "Noch keine eigenen oder eingeladenen Cloud-Projekte.",
    );
  }
  async function restore(row: CloudProject, media: boolean, guard: () => void) {
    if (!service || !account) return;
    const remote = await service.getProject(row.id, account.id);
    guard();
    const access = await new TeamService(service).getAccess(
      remote.id,
      account.id,
    );
    guard();
    const copy = structuredClone(remote.snapshot);
    for (let i = 0; i < copy.audio.assets.length; i++) {
      const asset = copy.audio.assets[i]!;
      delete asset.localUri;
      if (media) {
        const bytes = await service.downloadMedia(
          audioObjectPath(remote.owner_id, remote.id, asset.id),
          asset.sizeBytes,
          account.id,
        );
        guard();
        copy.audio.assets[i] = await cacheAudioBytes(asset, bytes);
        guard();
      }
    }
    // Explicit separate workspace: existing local drafts and their undo remain intact.
    const remoteProjectId = copy.id;
    copy.id = createId("project");
    const local = await getRepository();
    guard();
    await local.setSetting(`origin:${copy.id}`, {
      userId: account.id,
      cloudProjectId: remote.id,
      remoteProjectId,
      revision: remote.revision,
    });
    guard();
    await app.save(createHistory(copy));
    guard();
    setStatus(
      `Arbeitskopie angelegt · ${access.can_edit ? "Cloud-Bearbeitung möglich" : "Leserecht; Änderungen bleiben lokal"}.`,
    );
    router.push(`/editor/${encodeURIComponent(copy.id)}`);
  }
  if (!service)
    return (
      <Card>
        <Label bold>Cloud noch nicht eingerichtet</Label>
        <Label muted>Lokale Projekte bleiben ohne Konto verfügbar.</Label>
      </Card>
    );
  return (
    <View style={{ gap: 18, maxWidth: 760 }}>
      <Label muted>
        Eigene und eingeladene Projekte aus dem Testkonto. Beim Öffnen entsteht
        eine neue Arbeitskopie; deine vorhandenen Entwürfe bleiben erhalten.
      </Label>
      {!account ? (
        <Card>
          <Label bold>Im Testkonto anmelden</Label>
          <Field
            label="Cloud E-Mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Cloud Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />
          <Button
            primary
            disabled={busy || !email.trim() || !password}
            onPress={() =>
              void run(async () => {
                await service.signIn(email, password);
                setPassword("");
              })
            }
          >
            Anmelden
          </Button>
          <Label muted size={12}>
            Ein Konto kannst du im Projektmenü unter „Freigaben“ erstellen.
            Bestätige danach die E-Mail-Adresse.
          </Label>
        </Card>
      ) : (
        <>
          <Card>
            <Label size={13}>{account.email ?? "Angemeldetes Konto"}</Label>
            <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
              <Button primary disabled={busy} onPress={() => void run(refresh)}>
                Cloud-Projekte laden
              </Button>
              <Button
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await service.signOut();
                  })
                }
              >
                Abmelden
              </Button>
            </View>
          </Card>
          <Card>
            <Label bold>Team-Einladung annehmen</Label>
            <Field
              label="Einladungslink oder Einladungscode"
              value={invite}
              onChangeText={setInvite}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Label muted size={12}>
              Nur das Konto mit der eingeladenen, bestätigten E-Mail-Adresse
              kann beitreten. Leser sehen den Entwurf einschließlich Notizen und
              privat gesicherter Musik.
            </Label>
            <Button
              disabled={busy || !invite.trim()}
              onPress={() =>
                void run(async (guard) => {
                  const token = invite.includes("#invite=")
                    ? invite.split("#invite=")[1]!
                    : invite.trim();
                  await new TeamService(service).acceptInvitation(
                    token,
                    account.id,
                  );
                  guard();
                  setInvite("");
                  await refresh(guard);
                  guard();
                  setStatus(
                    "Einladung angenommen. Das Projekt steht jetzt in der Cloudliste.",
                  );
                })
              }
            >
              Einladung annehmen
            </Button>
          </Card>
          {rows.map((row) => (
            <Card key={row.id}>
              <Label size={20} bold>
                {row.title}
              </Label>
              <Label muted size={13}>
                {row.owner_id === account.id
                  ? "Eigenes Projekt"
                  : "Teamprojekt"}{" "}
                · Serverstand {row.revision} · {row.snapshot.people.length}{" "}
                Personen · {row.snapshot.audio.assets.length} Musikdateien
              </Label>
              <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
                <Button
                  disabled={busy}
                  onPress={() =>
                    void run((guard) => restore(row, false, guard))
                  }
                >
                  Als Arbeitskopie öffnen
                </Button>
                {row.snapshot.audio.assets.length ? (
                  <Button
                    disabled={busy}
                    onPress={() =>
                      void run((guard) => restore(row, true, guard))
                    }
                  >
                    Mit Musik als Arbeitskopie öffnen
                  </Button>
                ) : null}
              </View>
            </Card>
          ))}
        </>
      )}
      {busy ? <Label muted>Cloud-Aktion läuft …</Label> : null}
      {status ? (
        <View accessibilityLiveRegion="polite">
          <Label>{status}</Label>
        </View>
      ) : null}
    </View>
  );
}
