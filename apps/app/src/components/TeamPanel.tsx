import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, View } from "react-native";
import { Button, Field, Label, useTheme } from "@choreoflow/ui";
import {
  TeamService,
  teamErrorMessage,
  type CloudService,
  type CreatedInvitation,
  type MemberRole,
  type ProjectAccess,
  type ProjectTeam,
  type TeamInvitation,
  type TeamMember,
} from "@choreoflow/data";

interface TeamPanelProps {
  service: CloudService;
  userId: string;
  cloudProjectId: string;
  onMessage?: (message: string) => void;
}
interface TeamState {
  access: ProjectAccess;
  team: ProjectTeam | null;
}
type Confirmation =
  | { kind: "member"; member: TeamMember; role: MemberRole | null }
  | { kind: "invitation"; invitation: TeamInvitation };
const roleName = {
  owner: "Eigentümer",
  editor: "Bearbeiten",
  reader: "Nur lesen",
};
const dateLabel = (date: string) => new Date(date).toLocaleString("de-DE");
const activeInvitation = (invitation: TeamInvitation) =>
  !invitation.accepted_at &&
  !invitation.revoked_at &&
  Date.parse(invitation.expires_at) > Date.now();

/** A different account/project remounts the scope immediately, before any stale state can render. */
export function TeamPanel(props: TeamPanelProps) {
  return (
    <ScopedTeamPanel
      key={`${props.userId}:${props.cloudProjectId}`}
      {...props}
    />
  );
}
function ScopedTeamPanel({
  service,
  userId,
  cloudProjectId,
  onMessage,
}: TeamPanelProps) {
  const t = useTheme();
  const teamService = useMemo(() => new TeamService(service), [service]);
  const [model, setModel] = useState<TeamState | null>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("reader");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [fresh, setFresh] = useState<
    (CreatedInvitation & { email: string }) | null
  >(null);
  const mounted = useRef(false),
    running = useRef(false),
    generation = useRef(0);
  const invalidate = useCallback(() => {
    mounted.current = false;
    generation.current++;
  }, []);

  const readTeam = useCallback(
    async (isCurrent: () => boolean): Promise<TeamState | null> => {
      const access = await teamService.getAccess(cloudProjectId, userId);
      if (!isCurrent()) return null;
      const team =
        access.role === "owner" && access.owner_id === userId
          ? await teamService.getTeam(cloudProjectId, userId)
          : null;
      return isCurrent() ? { access, team } : null;
    },
    [teamService, cloudProjectId, userId],
  );

  const run = useCallback(
    async (action: (isCurrent: () => boolean) => Promise<void>) => {
      if (!mounted.current || running.current) return;
      running.current = true;
      const request = ++generation.current;
      const isCurrent = () => mounted.current && request === generation.current;
      setBusy(true);
      setStatus("");
      try {
        await action(isCurrent);
      } catch (error) {
        if (isCurrent()) setStatus(teamErrorMessage(error));
      } finally {
        if (isCurrent()) {
          running.current = false;
          setBusy(false);
        }
      }
    },
    [],
  );

  const refresh = useCallback(
    () =>
      run(async (isCurrent) => {
        const next = await readTeam(isCurrent);
        if (next) setModel(next);
      }),
    [run, readTeam],
  );

  useEffect(() => {
    mounted.current = true;
    running.current = false;
    generation.current++;
    setModel(null);
    setFresh(null);
    setConfirmation(null);
    setRole("reader");
    setEmail("");
    void refresh();
    return invalidate;
  }, [refresh, invalidate]);

  const isOwner =
    model?.access.role === "owner" && model.access.owner_id === userId;
  const team = model?.team;
  const reservedEditors = team
    ? team.members.filter((member) => member.role === "editor").length +
      team.invitations.filter(
        (invitation) =>
          invitation.role === "editor" && activeInvitation(invitation),
      ).length
    : 0;
  const mayInviteEditor = !!model?.access.owner_has_pro && reservedEditors < 4;
  const freshValue = fresh
    ? Platform.OS === "web" && typeof window !== "undefined"
      ? `${window.location.origin}/#invite=${fresh.token}`
      : fresh.token
    : "";

  const invite = () =>
    run(async (isCurrent) => {
      const created = await teamService.invite(
        cloudProjectId,
        email,
        role,
        userId,
      );
      if (!isCurrent()) return;
      setFresh({ ...created, email: email.trim().toLowerCase() });
      setEmail("");
      const message = "Einladung erstellt. Es wurde keine E-Mail versendet.";
      setStatus(message);
      onMessage?.(message);
      const next = await readTeam(isCurrent);
      if (next) setModel(next);
    });
  const confirmChange = () =>
    run(async (isCurrent) => {
      if (!confirmation) return;
      if (confirmation.kind === "invitation") {
        await teamService.revokeInvitation(confirmation.invitation.id, userId);
        if (!isCurrent()) return;
        if (fresh?.id === confirmation.invitation.id) setFresh(null);
      } else {
        await teamService.setMemberRole(
          cloudProjectId,
          confirmation.member.user_id,
          confirmation.role,
          userId,
        );
      }
      if (!isCurrent()) return;
      setConfirmation(null);
      const message =
        confirmation.kind === "invitation"
          ? "Einladung widerrufen."
          : confirmation.role === null
            ? "Mitglied entfernt."
            : "Mitgliedsrolle geändert.";
      setStatus(message);
      onMessage?.(message);
      const next = await readTeam(isCurrent);
      if (next) setModel(next);
    });

  return (
    <View style={{ gap: 14 }} testID="team-panel">
      <Label size={18} bold>
        Projektteam
      </Label>
      <Label muted size={13}>
        Zugänge gelten für dieses Cloud-Projekt. Lokale Projektdateien bleiben
        auf dem jeweiligen Gerät.
      </Label>
      {!!status && (
        <View accessibilityRole="alert">
          <Label>{status}</Label>
        </View>
      )}
      {!model && (
        <Label muted>
          {busy
            ? "Team wird geladen …"
            : "Teamdaten konnten nicht geladen werden."}
        </Label>
      )}
      <Button
        disabled={busy}
        onPress={() => {
          setConfirmation(null);
          void refresh();
        }}
      >
        Team aktualisieren
      </Button>
      {model && (
        <>
          <Label bold>Deine Rolle: {roleName[model.access.role]}</Label>
          <Label muted>
            {model.access.can_edit
              ? "Du darfst Änderungen im Cloud-Projekt speichern."
              : "Du kannst den Cloud-Stand lesen. Änderungen dürfen nicht in dieses Cloud-Projekt gespeichert werden."}
          </Label>
          {model.access.role === "editor" && !model.access.owner_has_pro && (
            <Label muted>
              Bearbeiten ist ausgesetzt, solange der Eigentümer keinen aktiven
              Pro-Tarif hat.
            </Label>
          )}
          {!isOwner && (
            <Label muted>
              Einladungen und Mitglieder verwaltet der Projekteigentümer.
            </Label>
          )}
        </>
      )}
      {isOwner && team && (
        <>
          <View style={{ height: 1, backgroundColor: t.line }} />
          <Label bold>Person einladen</Label>
          <Label muted size={13}>
            Es wird keine E-Mail versendet. Gib den Link selbst an die
            eingeladene Person weiter. Sie benötigt ein bestätigtes Konto mit
            dieser E-Mail-Adresse.
          </Label>
          <Field
            label="E-Mail für Einladung"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button
              selected={role === "reader"}
              disabled={busy}
              onPress={() => setRole("reader")}
              accessibilityLabel={`Einladungsrolle Nur lesen${role === "reader" ? ", ausgewählt" : ""}`}
            >
              Nur lesen
            </Button>
            <Button
              selected={role === "editor"}
              disabled={busy || !mayInviteEditor}
              onPress={() => setRole("editor")}
              accessibilityLabel={`Einladungsrolle Bearbeiten${role === "editor" ? ", ausgewählt" : ""}`}
            >
              Bearbeiten
            </Button>
          </View>
          <Label size={12} muted>
            {model.access.owner_has_pro
              ? `${reservedEditors} von 4 Bearbeitungsplätzen vergeben oder reserviert.`
              : "Bearbeitungsrechte benötigen einen aktiven Pro-Tarif des Eigentümers. Einladungen zum Lesen sind möglich."}
          </Label>
          <Button
            primary
            disabled={
              busy || !email.trim() || (role === "editor" && !mayInviteEditor)
            }
            onPress={() => void invite()}
          >
            Einladungslink erstellen
          </Button>
          {fresh && (
            <View
              style={{
                gap: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: t.line,
                borderRadius: 10,
              }}
            >
              <Label bold>Einladung für {fresh.email}</Label>
              <Field
                label={
                  Platform.OS === "web"
                    ? "Neuer Einladungslink"
                    : "Neuer Einladungscode"
                }
                value={freshValue}
                editable={false}
                multiline
                selectTextOnFocus
                contextMenuHidden={false}
              />
              <Label size={12} muted>
                Gültig bis {dateLabel(fresh.expires_at)}. Der vollständige Link
                wird nur jetzt angezeigt. Du kannst ihn markieren und kopieren.
              </Label>
              {Platform.OS === "web" && (
                <Button
                  disabled={busy}
                  onPress={() =>
                    void run(async (isCurrent) => {
                      if (!navigator.clipboard?.writeText)
                        throw new Error(
                          "Bitte den Link im Feld markieren und kopieren.",
                        );
                      await navigator.clipboard.writeText(freshValue);
                      if (isCurrent()) setStatus("Einladungslink kopiert.");
                    })
                  }
                >
                  Einladungslink kopieren
                </Button>
              )}
              <Button disabled={busy} onPress={() => setFresh(null)}>
                Link ausblenden
              </Button>
            </View>
          )}
          {confirmation && (
            <View
              style={{
                gap: 10,
                padding: 12,
                backgroundColor: t.tint,
                borderRadius: 10,
              }}
              testID="team-confirmation"
            >
              <Label bold>
                {confirmation.kind === "invitation"
                  ? "Einladung widerrufen?"
                  : confirmation.role === null
                    ? "Mitglied entfernen?"
                    : "Rolle ändern?"}
              </Label>
              <Label>
                {confirmation.kind === "invitation"
                  ? `Der noch nicht angenommene Link für ${confirmation.invitation.email} wird ungültig.`
                  : confirmation.role === null
                    ? `${confirmation.member.email ?? "Dieses Konto"} verliert den Zugang zu diesem Cloud-Projekt. Bereits gespeicherte lokale Kopien werden nicht gelöscht.`
                    : `${confirmation.member.email ?? "Dieses Konto"} erhält die Rolle „${roleName[confirmation.role]}“. ${confirmation.role === "reader" ? "Speichern im Cloud-Projekt ist danach nicht mehr erlaubt." : "Speichern im Cloud-Projekt ist danach erlaubt."}`}
              </Label>
              <Button disabled={busy} onPress={() => void confirmChange()}>
                Änderung bestätigen
              </Button>
              <Button disabled={busy} onPress={() => setConfirmation(null)}>
                Abbrechen
              </Button>
            </View>
          )}
          <Label size={16} bold>
            Mitglieder ({team.members.length})
          </Label>
          {team.members.map((member) => (
            <View
              key={member.user_id}
              style={{
                gap: 8,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: t.line,
              }}
            >
              <Label bold>
                {member.email ?? "Konto ohne E-Mail"}
                {member.user_id === userId ? " (du)" : ""}
              </Label>
              <Label muted size={13}>
                {roleName[member.role]}
              </Label>
              {member.role !== "owner" && (
                <>
                  <Button
                    disabled={
                      busy ||
                      !!confirmation ||
                      (member.role === "reader" && !mayInviteEditor)
                    }
                    onPress={() =>
                      setConfirmation({
                        kind: "member",
                        member,
                        role: member.role === "editor" ? "reader" : "editor",
                      })
                    }
                  >
                    {member.role === "editor"
                      ? "Auf Lesen umstellen"
                      : "Bearbeiten erlauben"}
                  </Button>
                  <Button
                    disabled={busy || !!confirmation}
                    onPress={() =>
                      setConfirmation({ kind: "member", member, role: null })
                    }
                  >
                    Mitglied entfernen
                  </Button>
                </>
              )}
            </View>
          ))}
          <Label size={16} bold>
            Einladungen ({team.invitations.length})
          </Label>
          {team.invitations.length === 0 && (
            <Label muted>Keine Einladungen vorhanden.</Label>
          )}
          {team.invitations.map((invitation) => (
            <View
              key={invitation.id}
              style={{
                gap: 8,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: t.line,
              }}
            >
              <Label bold>{invitation.email}</Label>
              <Label size={13} muted>
                {roleName[invitation.role]} ·{" "}
                {invitation.revoked_at
                  ? "Widerrufen"
                  : invitation.accepted_at
                    ? "Angenommen"
                    : activeInvitation(invitation)
                      ? `Offen bis ${dateLabel(invitation.expires_at)}`
                      : "Abgelaufen"}
              </Label>
              {activeInvitation(invitation) && (
                <Button
                  disabled={busy || !!confirmation}
                  onPress={() =>
                    setConfirmation({ kind: "invitation", invitation })
                  }
                >
                  Einladung widerrufen
                </Button>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
