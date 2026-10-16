import React, { useState } from "react";
import { View } from "react-native";
import { ArrowUp, ArrowDown, Copy, Trash2 } from "lucide-react-native";
import { Button, Label, useTheme } from "@choreoflow/ui";
import {
  prepareFormationEdit,
  type FormationEditPlan,
  type Project,
} from "@choreoflow/core";

type FormationAction = Parameters<typeof prepareFormationEdit>[1];
const secondsLabel = (seconds: number) =>
  `${seconds.toFixed(2).replace(".", ",")} s`;
const clockLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
const timedNames = {
  lift: "Hebefigur",
  prop: "Requisite",
  note: "Notiz",
  marker: "Marker",
  audio: "Musikclip",
  tempo: "Tempowechsel",
};

/** Receives a fresh key for each revision/selection, so previews never outlive their source. */
export function FormationsPanel({
  project,
  formationId,
  busy,
  onPreview,
  onApply,
}: {
  project: Project;
  formationId: string;
  busy: boolean;
  onPreview: () => void;
  onApply: (plan: FormationEditPlan) => Promise<unknown>;
}) {
  const t = useTheme();
  const [preview, setPreview] = useState<{
    title: string;
    plan: FormationEditPlan;
    resolutions: Record<string, "keep-absolute">;
  } | null>(null);
  const [error, setError] = useState("");
  const index = project.formations.findIndex((f) => f.id === formationId);
  const formation = project.formations[index];
  if (!formation) return null;

  const prepare = (
    action: FormationAction,
    title: string,
    resolutions: Record<string, "keep-absolute"> = {},
  ) => {
    if (busy) return;
    setError("");
    try {
      const plan = prepareFormationEdit(project, action, {
        timing: "keep-absolute",
        newTransitionSeconds: 4,
        unmappedEventResolutions: resolutions,
      });
      onPreview();
      setPreview({ title, plan, resolutions });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const plan = preview?.plan;
  return (
    <View style={{ gap: 14 }} testID="formations-panel">
      <Label size={12} muted>
        AKTUELLE FORMATION
      </Label>
      <Label size={18} bold>
        {formation.name}
      </Label>
      <View testID="formation-position">
        <Label muted>
          Position {index + 1} von {project.formations.length}
        </Label>
      </View>
      <Label muted size={13}>
        Musik und zeitgebundene Elemente bleiben an ihrer Zeitposition.
      </Label>
      {!!error && (
        <View accessibilityRole="alert">
          <Label style={{ color: t.danger }}>{error}</Label>
        </View>
      )}
      {plan && preview ? (
        <View style={{ gap: 12 }} testID="formation-preview">
          <View style={{ height: 1, backgroundColor: t.line }} />
          <Label bold size={16}>
            {preview.title}
          </Label>
          <Label>
            Dauer: {secondsLabel(plan.durationBeforeSeconds)} →{" "}
            {secondsLabel(plan.durationAfterSeconds)}
          </Label>
          {plan.newTransitionCount > 0 && (
            <Label>
              {plan.newTransitionCount === 1
                ? "1 Übergang wird"
                : `${plan.newTransitionCount} Übergänge werden`}{" "}
              neu verbunden. Neue Verbindungen sind gerade und dauern 4
              Sekunden.
            </Label>
          )}
          {plan.removedGroupMotionCount > 0 && (
            <Label style={{ color: t.danger }}>
              {plan.removedGroupMotionCount === 1
                ? "1 Gruppenbewegung entfällt."
                : `${plan.removedGroupMotionCount} Gruppenbewegungen entfallen.`}
            </Label>
          )}
          {plan.removedSingleMotionCount > 0 && (
            <Label style={{ color: t.danger }}>
              {plan.removedSingleMotionCount === 1
                ? "1 Einzelweg entfällt."
                : `${plan.removedSingleMotionCount} Einzelwege entfallen.`}
            </Label>
          )}
          {plan.retainedOutgoingMotionCount > 0 && (
            <Label>
              Die bisherige Bewegung zur nächsten Formation bleibt nach der
              Kopie erhalten, einschließlich voller Drehungen.
            </Label>
          )}
          {plan.retainedTimedElements.slice(0, 4).map((item) => (
            <Label key={`${item.kind}:${item.id}`} size={13} muted>
              {timedNames[item.kind]} bleibt bei {clockLabel(item.startSeconds)}{" "}
              und muss im neuen Ablauf geprüft werden.
            </Label>
          ))}
          {plan.retainedTimedElements.length > 4 && (
            <Label size={13} muted>
              Weitere {plan.retainedTimedElements.length - 4} zeitgebundene
              Elemente bleiben unverändert.
            </Label>
          )}
          {plan.blockers.map((blocker, i) => (
            <View key={`${blocker.code}:${i}`} style={{ gap: 8 }}>
              <View accessibilityRole="alert">
                <Label style={{ color: t.danger }}>{blocker.message}</Label>
              </View>
              {blocker.code === "event-outside-duration" && blocker.eventId && (
                <>
                  <Label size={13} muted>
                    {project.lifts.find((item) => item.id === blocker.eventId)
                      ?.name ??
                      project.props.find((item) => item.id === blocker.eventId)
                        ?.name ??
                      "Dieses Element"}
                    : Ein Teil liegt danach außerhalb des abspielbaren
                    Formationsablaufs. Alle gespeicherten Zeitwerte bleiben
                    erhalten.
                  </Label>
                  <Button
                    disabled={busy}
                    onPress={() =>
                      prepare(plan.action, preview.title, {
                        ...preview.resolutions,
                        [blocker.eventId!]: "keep-absolute",
                      })
                    }
                  >
                    Zeitwerte vollständig behalten
                  </Button>
                </>
              )}
            </View>
          ))}
          <Label size={12} muted>
            Diese Änderung lässt sich mit „Rückgängig“ vollständig zurücknehmen.
          </Label>
          <Button
            primary
            disabled={
              busy ||
              plan.isNoop ||
              plan.blockers.length > 0 ||
              !plan.nextProject
            }
            onPress={() => void onApply(plan)}
          >
            {busy ? "Wird gespeichert …" : "Änderung anwenden"}
          </Button>
          <Button disabled={busy} onPress={() => setPreview(null)}>
            Abbrechen
          </Button>
        </View>
      ) : (
        <>
          <Button
            disabled={busy || project.formations.length >= 200}
            onPress={() =>
              prepare(
                { type: "duplicate", formationId },
                `„${formation.name}“ duplizieren`,
              )
            }
          >
            <Copy size={17} color={t.text} />
            <Label>Duplizieren</Label>
          </Button>
          <Label size={12} muted>
            Die Kopie wird direkt dahinter eingefügt.
          </Label>
          <Button
            disabled={busy || index === 0}
            accessibilityLabel="Formation eine Position früher"
            onPress={() =>
              prepare(
                {
                  type: "move",
                  formationId,
                  beforeFormationId: project.formations[index - 1].id,
                },
                `„${formation.name}“ eine Position früher`,
              )
            }
          >
            <ArrowUp size={17} color={t.text} />
            <Label>Eine Position früher</Label>
          </Button>
          <Button
            disabled={busy || index === project.formations.length - 1}
            accessibilityLabel="Formation eine Position später"
            onPress={() =>
              prepare(
                {
                  type: "move",
                  formationId,
                  beforeFormationId: project.formations[index + 2]?.id ?? null,
                },
                `„${formation.name}“ eine Position später`,
              )
            }
          >
            <ArrowDown size={17} color={t.text} />
            <Label>Eine Position später</Label>
          </Button>
          <Button
            disabled={busy || project.formations.length === 1}
            accessibilityLabel="Ausgewählte Formation löschen"
            onPress={() =>
              prepare(
                { type: "delete", formationId },
                `„${formation.name}“ löschen`,
              )
            }
          >
            <Trash2 size={17} color={t.danger} />
            <Label style={{ color: t.danger }}>Formation löschen</Label>
          </Button>
          {project.formations.length === 1 && (
            <Label size={12} muted>
              Mindestens eine Formation bleibt im Projekt.
            </Label>
          )}
          {project.formations.length >= 200 && (
            <Label size={12} muted>
              Das Projekt enthält bereits 200 Formationen.
            </Label>
          )}
        </>
      )}
    </View>
  );
}
