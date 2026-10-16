import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, type AudioStatus } from 'expo-audio';
import { projectDuration, type AudioAsset, type AudioClip, type Project } from '@choreoflow/core';
import { resolveAudio } from './storage';
import { clipEnd, clipSourceTime, clipTimelineTime, clipVolume } from './timing';

export interface Playback {
  time: number; playing: boolean; speed: number; duration: number; error: string | null;
  setTime: Dispatch<SetStateAction<number>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setSpeed: Dispatch<SetStateAction<number>>;
}
/** While music is active, player.currentTime is the master clock, including during buffering. */
export function usePlayback(project: Project | undefined): Playback {
  const clipJson = JSON.stringify(project?.audio.clips[0] ?? null);
  const clip = useMemo(() => JSON.parse(clipJson) as AudioClip | null, [clipJson]);
  const assetJson = JSON.stringify(project?.audio.assets.find(item => item.id === clip?.assetId) ?? null);
  const asset = useMemo(() => JSON.parse(assetJson) as AudioAsset | null, [assetJson]);
  const duration = Math.max(project ? projectDuration(project) : 0, clip ? clipEnd(clip) : 0);
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const [time, updateTime] = useState(0), [playing, updatePlaying] = useState(false), [speed, updateSpeed] = useState(1), [error, setError] = useState<string | null>(null);
  const timeRef = useRef(0), playingRef = useRef(false), speedRef = useRef(1), durationRef = useRef(duration), clipRef = useRef(clip);
  const sourceReady = useRef(false), loading = useRef(false), generation = useRef(0), audioStarted = useRef(0), finished = useRef(false);
  const mode = useRef<'silent' | 'seeking' | 'audio'>('silent');
  const anchor = useRef({ time: 0, milliseconds: performance.now() });
  durationRef.current = duration; clipRef.current = clip;
  const emitTime = useCallback((seconds: number) => { timeRef.current = seconds; updateTime(seconds); }, []);
  const stopAudio = useCallback(() => { generation.current++; mode.current = 'silent'; player.pause(); }, [player]);
  const pause = useCallback(() => {
    playingRef.current = false; updatePlaying(false); stopAudio();
    anchor.current = { time: timeRef.current, milliseconds: performance.now() };
  }, [stopAudio]);
  const beginAudio = useCallback((timelineTime: number) => {
    const active = clipRef.current;
    if (!active || !sourceReady.current || !player.isLoaded || !playingRef.current) return;
    const request = ++generation.current; mode.current = 'seeking'; finished.current = false;
    player.pause();
    void player.seekTo(clipSourceTime(active, timelineTime), 0, 0).then(() => {
      if (request !== generation.current || !playingRef.current) return;
      player.volume = clipVolume(active, timelineTime); player.setPlaybackRate(speedRef.current); player.play();
      audioStarted.current = performance.now(); mode.current = 'audio';
    }).catch(reason => { if (request === generation.current) { pause(); setError(reason instanceof Error ? reason.message : 'Die Musikposition konnte nicht gesetzt werden.'); } });
  }, [player, pause]);
  const setTime = useCallback<Dispatch<SetStateAction<number>>>(value => {
    const requested = typeof value === 'function' ? value(timeRef.current) : value;
    if (!Number.isFinite(requested)) return;
    const next = Math.max(0, Math.min(durationRef.current, requested));
    generation.current++; player.pause(); mode.current = 'silent'; emitTime(next); anchor.current = { time: next, milliseconds: performance.now() };
    const active = clipRef.current;
    if (active && next >= active.startSeconds && next < clipEnd(active)) {
      if (playingRef.current) beginAudio(next);
      else if (sourceReady.current && player.isLoaded) void player.seekTo(clipSourceTime(active, next), 0, 0).catch(reason => setError(String(reason)));
    }
  }, [player, emitTime, beginAudio]);
  const setPlaying = useCallback<Dispatch<SetStateAction<boolean>>>(value => {
    const next = typeof value === 'function' ? value(playingRef.current) : value;
    if (!next) { pause(); return; }
    if (!durationRef.current) return;
    if (timeRef.current >= durationRef.current) setTime(0);
    playingRef.current = true; updatePlaying(true); anchor.current = { time: timeRef.current, milliseconds: performance.now() };
    const active = clipRef.current;
    if (active && timeRef.current >= active.startSeconds && timeRef.current < clipEnd(active)) beginAudio(timeRef.current);
  }, [pause, setTime, beginAudio]);
  const setSpeed = useCallback<Dispatch<SetStateAction<number>>>(value => {
    const requested = typeof value === 'function' ? value(speedRef.current) : value;
    if (!Number.isFinite(requested)) return;
    const next = Math.max(0.5, Math.min(2, requested)); speedRef.current = next; updateSpeed(next);
    anchor.current = { time: timeRef.current, milliseconds: performance.now() }; player.setPlaybackRate(next);
  }, [player]);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' }).catch(reason => setError(String(reason)));
    const appSubscription = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    const audioSubscription = player.addListener('playbackStatusUpdate', (status: AudioStatus & { error?: string }) => {
      if (status.didJustFinish) finished.current = true;
      if (status.error) {
        // A decoder failure must not leave the timeline stuck waiting for isLoaded.
        if (!status.isLoaded) sourceReady.current = false;
        pause(); setError(`Audio konnte nicht wiedergegeben werden: ${status.error}`);
      }
    });
    return () => { appSubscription.remove(); audioSubscription.remove(); };
  }, [player, pause]);
  useEffect(() => { pause(); emitTime(0); anchor.current = { time: 0, milliseconds: performance.now() }; }, [project?.id, pause, emitTime]);
  useEffect(() => {
    let cancelled = false; let release: (() => void) | undefined;
    pause(); setError(null); sourceReady.current = false; loading.current = Boolean(asset); player.replace(null);
    if (asset) {
      void resolveAudio(asset).then(source => {
        if (cancelled) { source.release(); return; }
        release = source.release; player.replace({ uri: source.uri }); sourceReady.current = true;
      }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Musikdatei konnte nicht geladen werden.'); }).finally(() => {
        if (!cancelled) { loading.current = false; anchor.current = { time: timeRef.current, milliseconds: performance.now() }; }
      });
    }
    return () => { cancelled = true; stopAudio(); sourceReady.current = false; release?.(); };
  }, [asset, player, pause, stopAudio]);
  useEffect(() => { pause(); anchor.current = { time: timeRef.current, milliseconds: performance.now() }; }, [clipJson, pause]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (!playingRef.current || loading.current) return;
      const now = performance.now(), active = clipRef.current;
      if (active && sourceReady.current) {
        // Loading a decoder must not advance the scene without its sound.
        if (!player.isLoaded && timeRef.current >= active.startSeconds && timeRef.current < clipEnd(active)) return;
        if (mode.current === 'seeking') return;
        if (mode.current === 'audio') {
          const current = clipTimelineTime(active, player.currentTime);
          if (finished.current || player.currentTime >= active.trimEndSeconds - 0.015) {
            player.pause(); mode.current = 'silent'; emitTime(clipEnd(active)); anchor.current = { time: clipEnd(active), milliseconds: now };
          } else {
            emitTime(current); player.volume = clipVolume(active, current);
            if (!player.playing && !player.isBuffering && now - audioStarted.current > 500) pause();
          }
          return;
        }
        if (timeRef.current >= active.startSeconds && timeRef.current < clipEnd(active)) { beginAudio(timeRef.current); return; }
      }
      const next = anchor.current.time + (now - anchor.current.milliseconds) / 1000 * speedRef.current;
      if (active && sourceReady.current && timeRef.current < active.startSeconds && next >= active.startSeconds) {
        emitTime(active.startSeconds); anchor.current = { time: active.startSeconds, milliseconds: now }; beginAudio(active.startSeconds); return;
      }
      if (next >= durationRef.current) { emitTime(durationRef.current); pause(); return; }
      emitTime(next);
    }, 33);
    return () => clearInterval(timer);
  }, [playing, player, emitTime, beginAudio, pause]);
  return { time, playing, setTime, setPlaying, speed, setSpeed, duration, error };
}
