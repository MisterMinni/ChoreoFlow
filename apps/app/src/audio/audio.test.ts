import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AudioClip } from '@choreoflow/core';
import { clipDuration, clipEnd, clipSourceTime, clipTimelineTime, clipVolume } from './timing';
import { MAX_AUDIO_BYTES, validateAudioFile, validateDuration } from './types';

const clip: AudioClip = { id: 'clip', assetId: 'audio', startSeconds: 8, trimStartSeconds: 2, trimEndSeconds: 10, volume: 0.8, fadeInSeconds: 2, fadeOutSeconds: 2 };
test('trimmed audio maps the source clock to the choreography offset and clamps at both boundaries', () => {
  assert.equal(clipDuration(clip), 8); assert.equal(clipEnd(clip), 16);
  assert.equal(clipSourceTime(clip, 9.5), 3.5); assert.equal(clipTimelineTime(clip, 3.5), 9.5);
  assert.equal(clipSourceTime(clip, 0), 2); assert.equal(clipSourceTime(clip, 50), 10);
  assert.equal(clipTimelineTime(clip, 0), 8); assert.equal(clipTimelineTime(clip, 50), 16);
});
test('volume envelope applies only inside the trimmed clip without altering time', () => {
  assert.equal(clipVolume(clip, 7), 0); assert.equal(clipVolume(clip, 8), 0);
  assert.equal(clipVolume(clip, 9), 0.4); assert.equal(clipVolume(clip, 12), 0.8);
  assert.equal(clipVolume(clip, 15), 0.4); assert.equal(clipVolume(clip, 16), 0);
  assert.equal(clipVolume({ ...clip, fadeInSeconds: 0, fadeOutSeconds: 0 }, 8), 0.8);
});
test('audio import validates size, supported filename and MIME independently of duration decoding', () => {
  assert.equal(validateAudioFile('TEST.WAV', MAX_AUDIO_BYTES, 'audio/wav'), 'wav');
  assert.equal(validateAudioFile('recording.m4a', 100, 'video/mp4'), 'm4a');
  assert.throws(() => validateAudioFile('test.wav', MAX_AUDIO_BYTES + 1, 'audio/wav'));
  assert.throws(() => validateAudioFile('test.wav', 0, 'audio/wav'));
  assert.throws(() => validateAudioFile('test.exe', 100, 'audio/wav'));
  assert.throws(() => validateAudioFile('test.wav', 100, 'text/plain'));
  validateDuration(600);
  for (const duration of [0, -1, Infinity, NaN, 600.01]) assert.throws(() => validateDuration(duration));
});
