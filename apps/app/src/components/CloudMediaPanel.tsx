import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { Project } from "@choreoflow/core";
import type { CloudService } from "@choreoflow/data";
import { Button, Card, Label } from "@choreoflow/ui";
import { cacheAudioBytes, readAudioBytes } from "../audio/storage";
import { audioObjectPath, validateAudioBytes } from "../audio/transfer";

type Props = {
  service: CloudService;
  userId: string;
  cloudProjectId: string;
  project: Project;
  onCache: (project: Project) => Promise<void>;
};
export function CloudMediaPanel({
  service,
  userId,
  cloudProjectId,
  project,
  onCache,
}: Props) {
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const running = useRef(false),
    generation = useRef(0),
    current = useRef(project);
  current.current = project;
  useEffect(() => {
    const invalidate = () => { generation.current++; };
    invalidate();
    setStatus("");
    return invalidate;
  }, [userId, cloudProjectId]);
  async function transfer(upload: boolean) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setStatus("");
    const scope = generation.current,
      source = structuredClone(project);
    const guard = () => {
      if (scope !== generation.current)
        throw new Error("Konto oder Projekt gewechselt.");
    };
    try {
      const remote = await service.getProject(cloudProjectId, userId);
      guard();
      if (upload && remote.owner_id !== userId)
        throw new Error(
          "Musik kann derzeit nur der Eigentümer übertragen. Teammitglieder können sie herunterladen.",
        );
      let transferred = 0;
      for (const asset of source.audio.assets) {
        const saved = remote.snapshot.audio.assets.find(
          (item) => item.id === asset.id,
        );
        if (
          !saved ||
          saved.sizeBytes !== asset.sizeBytes ||
          saved.name !== asset.name ||
          saved.durationSeconds !== asset.durationSeconds
        )
          throw new Error(
            "Bitte zuerst diesen Projektstand im Cloudkonto sichern. Seine Musikangaben stimmen noch nicht mit dem Server überein.",
          );
        const path = audioObjectPath(remote.owner_id, remote.id, asset.id);
        if (upload) {
          const bytes = await readAudioBytes(asset);
          guard();
          const format = validateAudioBytes(asset, bytes);
          validateAudioBytes(saved, bytes);
          await service.uploadMedia(path, bytes, format.mimeType, userId);
          guard();
        } else {
          const bytes = await service.downloadMedia(
            path,
            asset.sizeBytes,
            userId,
          );
          guard();
          validateAudioBytes(saved, bytes);
          const cached = await cacheAudioBytes(asset, bytes);
          guard();
          source.audio.assets = source.audio.assets.map((item) =>
            item.id === asset.id ? cached : item,
          );
        }
        transferred++;
      }
      if (!upload) {
        // Download completion must never replace edits made while it was running.
        if (JSON.stringify(current.current) !== JSON.stringify(project))
          throw new Error(
            "Der Entwurf wurde während des Downloads geändert. Die Musik liegt im Cache; bitte erneut laden, um sie zuzuordnen.",
          );
        await onCache(source);
        guard();
      }
      setStatus(
        `${transferred} Musikdatei${transferred === 1 ? "" : "en"} ${upload ? "privat in der Cloud gesichert" : "auf diesem Gerät verfügbar"}.`,
      );
    } catch (error) {
      if (scope === generation.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "Musikübertragung fehlgeschlagen. Bereits gesicherte Dateien bleiben erhalten.",
        );
    } finally {
      running.current = false;
      if (scope === generation.current) setBusy(false);
    }
  }
  return (
    <Card>
      <Label bold>Musik im Team</Label>
      <Label muted size={12}>
        Privater Speicher für Eigentümer und eingeladene Mitglieder. Maximal 20
        MB pro Datei; Free insgesamt 100 MB, Pro 1 GB. Öffentliche Probenlinks
        enthalten weiterhin keine Musik.
      </Label>
      {project.audio.assets.length ? (
        <>
          {project.audio.assets.map((asset) => (
            <Label key={asset.id} size={13}>
              {asset.name} · {(asset.sizeBytes / 1024 / 1024).toFixed(2)} MB
            </Label>
          ))}
          <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
            <Button disabled={busy} onPress={() => void transfer(true)}>
              Musik privat sichern
            </Button>
            <Button disabled={busy} onPress={() => void transfer(false)}>
              Musik auf dieses Gerät laden
            </Button>
          </View>
          <Label muted size={12}>
            Übertrage nur Musik, die du im Team verwenden darfst. Der Upload
            erfolgt bewusst über diese Schaltfläche. Bei Unterbrechung kannst du
            ihn erneut starten.
          </Label>
        </>
      ) : (
        <Label muted>
          Importiere zuerst unter „Musik“ eine Audiodatei und sichere den
          Projektstand.
        </Label>
      )}
      {status ? (
        <View accessibilityLiveRegion="polite">
          <Label>{status}</Label>
        </View>
      ) : null}
    </Card>
  );
}
