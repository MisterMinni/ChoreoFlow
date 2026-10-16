import React, {useEffect, useRef, useState} from 'react';
import {Platform, ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import {assertValidProject, projectDuration, type Project} from '@choreoflow/core';
import {getCloudService} from '@choreoflow/data';
import {Button, Card, Label, useTheme} from '@choreoflow/ui';
import {Stage2D} from '../src/components/Stage2D';

type SharedStand = {snapshot: Project; source_revision: number; created_at: string};

export default function SharedRehearsal() {
  const theme = useTheme();
  const [stand, setStand] = useState<SharedStand | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const timeRef = useRef(0);
  timeRef.current = time;
  const duration = stand ? projectDuration(stand.snapshot) : 0;

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        if (Platform.OS !== 'web' || typeof window === 'undefined') throw new Error('Bitte diesen Freigabelink im Browser öffnen. Native Links sind noch nicht eingerichtet.');
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new Error('Der Freigabelink ist unvollständig. Bitte den vollständigen Link vom Trainer öffnen.');
        const service = getCloudService();
        if (!service) throw new Error('Diese Vorschau ist noch nicht mit der Cloud-Testumgebung verbunden.');
        const result: unknown = await service.readShare(token);
        if (!result || typeof result !== 'object' || !('snapshot' in result)) throw new Error('Dieser Link ist ungültig, abgelaufen oder wurde widerrufen.');
        const shared = result as SharedStand;
        assertValidProject(shared.snapshot);
        if (live) setStand(shared);
      } catch (cause) {if (live) setError(cause instanceof Error ? cause.message : 'Der Probenstand konnte nicht geladen werden.');}
      finally {if (live) setLoading(false);}
    }
    void load();
    return () => {live = false;};
  }, []);

  useEffect(() => {
    if (!playing || !duration) return;
    let frameId = 0;
    const start = performance.now(), offset = timeRef.current;
    function frame(now: number) {
      const next = offset + (now - start) / 1000 * speed;
      if (next >= duration && !loop) {setTime(duration); setPlaying(false); return;}
      setTime(loop ? next % duration : next);
      frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [playing, duration, speed, loop]);

  return <SafeAreaView style={{flex: 1, backgroundColor: theme.bg}}>
    <ScrollView contentContainerStyle={{padding: 20, gap: 20, width: '100%', maxWidth: 1050, alignSelf: 'center'}}>
      <Label size={13} muted>CHOREOFLOW · PROBENANSICHT</Label>
      {loading ? <Card><Label>Freigegebenen Stand laden …</Label></Card> : error ? <Card><Label bold>Probenstand nicht verfügbar</Label><Label>{error}</Label></Card> : stand ? <>
        <View style={{gap: 6}}><Label size={28} bold>{stand.snapshot.name}</Label><Label muted size={13}>Veröffentlichter Serverstand {stand.source_revision} · nur ansehen</Label></View>
        <Stage2D project={stand.snapshot} time={time} selected={selected} onSelect={id => setSelected(current => current.includes(id) ? [] : [id])} showPaths={selected.length > 0} />
        <Card>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
            <Button primary onPress={() => {if (time >= duration) setTime(0); setPlaying(value => !value);}}>{playing ? 'Pause' : 'Abspielen'}</Button>
            <Button onPress={() => {setPlaying(false); setTime(0);}}>Zum Anfang</Button>
            <Button selected={loop} onPress={() => setLoop(value => !value)}>Wiederholen: {loop ? 'an' : 'aus'}</Button>
          </View>
          <Slider accessibilityLabel="Wiedergabeposition" minimumValue={0} maximumValue={Math.max(duration, 0.01)} value={time} onSlidingStart={() => setPlaying(false)} onValueChange={setTime} minimumTrackTintColor={theme.accent} />
          <Label size={13}>{time.toFixed(1)} / {duration.toFixed(1)} Sekunden</Label>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{[0.5, 0.75, 1, 1.5].map(value => <Button key={value} selected={speed === value} onPress={() => setSpeed(value)}>{`${value}×`}</Button>)}</View>
          <Label muted size={13}>Wähle deine Person auf der Bühne, um ihren Laufweg hervorzuheben. Diese Testansicht spielt ohne Musik.</Label>
          {selected.length ? <Button onPress={() => setSelected([])}>Hervorhebung aufheben</Button> : null}
        </Card>
        <Label muted size={12}>Dieser freigegebene Stand bleibt unverändert, wenn der Trainer den Entwurf bearbeitet. Er enthält keine privaten Probennotizen.</Label>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}
