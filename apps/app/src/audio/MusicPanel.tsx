import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Button, Card, Field, Label, useTheme } from '@choreoflow/ui';
import { createId, type AudioClip, type Project } from '@choreoflow/core';
import { getAudioWaveform, pickAudio } from './storage';
import { clipDuration } from './timing';

export function MusicPanel({ project, onChange }: { project: Project; onChange: (project: Project) => void | Promise<void> }) {
  const t = useTheme(); const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [waveform, setWaveform] = useState<number[] | null>(null);
  const clip = project.audio.clips[0]; const asset = project.audio.assets.find(item => item.id === clip?.assetId);
  const assetId = asset?.id;
  useEffect(() => {
    let active = true; setWaveform(null);
    if (asset) void getAudioWaveform(asset).then(value => { if (active) setWaveform(value); }).catch(() => undefined);
    return () => { active = false; };
  // Metadata is immutable for a given imported asset ID.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);
  const importMusic = async () => {
    setBusy(true); setError(null);
    try {
      const imported = await pickAudio(); if (!imported) return;
      const next = structuredClone(project);
      next.audio.assets.push(imported.asset);
      next.audio.clips = [{ id: createId('clip'), assetId: imported.asset.id, startSeconds: 0, trimStartSeconds: 0, trimEndSeconds: imported.asset.durationSeconds, fadeInSeconds: 0, fadeOutSeconds: 0, volume: 1 }];
      await onChange(next); setWaveform(imported.waveform);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Musikimport fehlgeschlagen.'); }
    finally { setBusy(false); }
  };
  const editClip = async (change: Partial<AudioClip>) => {
    if (!clip || !asset) return;
    const updated = { ...clip, ...change }; const length = clipDuration(updated);
    if (updated.trimStartSeconds < 0 || updated.trimEndSeconds > asset.durationSeconds || length < 0.05 || updated.startSeconds < 0 || updated.startSeconds > 600 || updated.volume < 0 || updated.volume > 1 || updated.fadeInSeconds < 0 || updated.fadeOutSeconds < 0 || updated.fadeInSeconds + updated.fadeOutSeconds > length) {
      setError('Bitte gültige Werte wählen: Trim innerhalb der Datei, mindestens 0,05 s Musik, Lautstärke 0–100 % und Blenden innerhalb des Clips.'); return;
    }
    setError(null); const next = structuredClone(project); next.audio.clips[0] = updated;
    try { await onChange(next); } catch (reason) { setError(String(reason)); }
  };
  const removeClip = async () => {
    try { const next = structuredClone(project); next.audio.clips = []; await onChange(next); }
    catch (reason) { setError(String(reason)); }
  };
  const numeric = (label: string, value: number, apply: (value: number) => void) => <Field key={`${clip?.id}-${label}-${value}`} label={label} defaultValue={String(Math.round(value * 100) / 100)} keyboardType="decimal-pad" onEndEditing={event => { const value = Number(event.nativeEvent.text.replace(',', '.')); if (!Number.isFinite(value)) setError('Bitte eine gültige Zahl eingeben.'); else apply(value); }} />;
  return <View style={{ gap: 14 }}>
    <Label bold>Musik</Label><Label muted size={12}>Import bleibt auf diesem Gerät. Maximal 20 MB und 10 Minuten. MP3, WAV oder andere vom Gerät lesbare Audiodateien.</Label>
    <Button primary disabled={busy} onPress={() => void importMusic()} testID="music-import">{busy ? 'Musik wird gespeichert …' : asset ? 'Musik ersetzen' : 'Musik importieren'}</Button>
    {error && <Label style={{ color: t.danger }}>{error}</Label>}
    {asset && clip && <><Card><Label bold>{asset.name}</Label><Label muted size={12}>{asset.durationSeconds.toFixed(2)} s Original · {(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB</Label>
      {waveform ? <Svg viewBox="0 0 240 72" width="100%" height={72} accessibilityLabel="Wellenform der importierten Audiodatei">{waveform.map((peak, index) => <Line key={index} x1={index * 2 + 1} x2={index * 2 + 1} y1={36 - Math.max(1, peak * 34)} y2={36 + Math.max(1, peak * 34)} stroke={t.accent} strokeWidth={1.5} />)}</Svg> : <Label muted size={12}>Eine Wellenform ist für diese Datei auf dieser Plattform noch nicht verfügbar. Die Wiedergabe nutzt die echte Audiodatei.</Label>}
      <Label size={12}>{clipDuration(clip).toFixed(2)} s im Projekt · Start bei {clip.startSeconds.toFixed(2)} s</Label></Card>
      {numeric('Anfang im Original (s)', clip.trimStartSeconds, value => void editClip({ trimStartSeconds: value }))}
      {numeric('Ende im Original (s)', clip.trimEndSeconds, value => void editClip({ trimEndSeconds: value }))}
      {numeric('Start in der Choreografie (s)', clip.startSeconds, value => void editClip({ startSeconds: value }))}
      {numeric('Lautstärke (%)', clip.volume * 100, value => void editClip({ volume: value / 100 }))}
      {numeric('Einblenden (s)', clip.fadeInSeconds, value => void editClip({ fadeInSeconds: value }))}
      {numeric('Ausblenden (s)', clip.fadeOutSeconds, value => void editClip({ fadeOutSeconds: value }))}
      <Label muted size={12}>Der Schnitt verändert nur den Musikclip. Formationen behalten ihre Zeitpositionen; das Original bleibt erhalten. Teilen und mehrere Clips folgen.</Label>
      <Button onPress={() => void removeClip()}>Musikclip entfernen</Button>
    </>}
  </View>;
}
