import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  checkConflicts,
  type MotionConflict,
  type Project,
} from "@choreoflow/core";
import { Button, Card, Label, useTheme } from "@choreoflow/ui";

interface Result {
  projectId: string;
  projectRevision: number;
  conflicts: MotionConflict[];
  elapsedMs: number;
}
export default function ConflictPanel({
  project,
  onSeek,
}: {
  project: Project;
  onSeek: (timeSeconds: number) => void;
}) {
  const theme = useTheme();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(
    () => new Map(project.people.map((person) => [person.id, person.label])),
    [project.people],
  );
  const stale =
    result !== null &&
    (result.projectId !== project.id ||
      result.projectRevision !== project.revision);
  const run = () => {
    setBusy(true);
    setError(null);
    // Yield once so assistive technologies/UI can announce the pending work.
    setTimeout(() => {
      try {
        const start = Date.now();
        setResult({
          projectId: project.id,
          projectRevision: project.revision,
          conflicts: checkConflicts(project, { maxResults: 100 }),
          elapsedMs: Date.now() - start,
        });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Die Prüfung konnte nicht abgeschlossen werden.",
        );
      } finally {
        setBusy(false);
      }
    }, 0);
  };
  return (
    <View style={{ gap: 14 }}>
      <Label bold size={19}>
        Bewegungen prüfen
      </Label>
      <Label muted>
        Die Prüfung vergleicht modellierte Abstände zur selben Zeit,
        Bühnenränder und Requisiten. Sie ist keine physische
        Sicherheitsfreigabe.
      </Label>
      <Button
        onPress={run}
        primary
        disabled={busy}
        accessibilityLabel="Modellierte Bewegungskonflikte berechnen"
      >
        {busy ? "Prüfung läuft …" : "Abstände prüfen"}
      </Button>
      {error && <Label style={{ color: theme.danger }}>{error}</Label>}
      {stale && (
        <Label style={{ color: theme.danger }}>
          Das Projekt wurde verändert. Bitte die Prüfung erneut starten.
        </Label>
      )}
      {result && (
        <>
          <Label bold>
            {result.conflicts.length === 0
              ? "Keine modellierten Hinweise gefunden"
              : `${result.conflicts.length}${result.conflicts.length >= 100 ? "+" : ""} Hinweise`}{" "}
            · {(result.elapsedMs / 1000).toFixed(2)} s
          </Label>
          {result.conflicts.length >= 100 && (
            <Label muted>
              Es werden die ersten 100 Hinweise angezeigt. Weitere Hinweise
              können vorhanden sein.
            </Label>
          )}
          <Label muted size={12}>
            Personen werden durch vereinfachte Kugelhüllen angenähert. Sehr
            kurze mögliche Annäherungen sind ausdrücklich als Näherung markiert.
          </Label>
          <ScrollView
            style={{ maxHeight: 400 }}
            contentContainerStyle={{ gap: 10 }}
          >
            {result.conflicts.map((conflict, index) => (
              <Card
                key={`${conflict.kind}-${conflict.personIds.join("-")}-${index}`}
                style={{ padding: 14 }}
              >
                <Label bold>
                  {conflict.kind === "person-distance"
                    ? "Personenabstand"
                    : conflict.kind === "stage-edge"
                      ? "Bühnenrand"
                      : "Requisite"}{" "}
                  ·{" "}
                  {conflict.personIds
                    .map((id) => names.get(id) ?? id)
                    .join(" / ")}
                </Label>
                <Label muted>
                  {conflict.startSeconds.toFixed(2)}–
                  {conflict.endSeconds.toFixed(2)} s ·{" "}
                  {conflict.kind === "stage-edge"
                    ? "Randabstand"
                    : "Kleinster geprüfter Abstand"}{" "}
                  {conflict.minimumDistance.toFixed(2)} m
                </Label>
                {conflict.objectId && (
                  <Label muted>
                    {project.props.find((prop) => prop.id === conflict.objectId)
                      ?.name ?? conflict.objectId}
                  </Label>
                )}
                {conflict.conservative && (
                  <Label muted size={12}>
                    Mögliche Annäherung innerhalb der zeitlichen Näherung.
                  </Label>
                )}
                <Button
                  onPress={() => onSeek(conflict.startSeconds)}
                  disabled={stale}
                  accessibilityLabel={`Zu Hinweis bei ${conflict.startSeconds.toFixed(2)} Sekunden springen`}
                >
                  Zur Stelle springen
                </Button>
              </Card>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
