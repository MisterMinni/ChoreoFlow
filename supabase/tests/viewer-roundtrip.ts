/** Integration helper: --fixture emits the deterministic Core fixtures. Pass a
 * JSON file containing the SQL viewer_snapshot results to verify the roundtrip.
 * It never connects to a service, reads credentials, or creates users itself. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertValidProject, createDemoProject, evaluateScene, projectDuration, type Project} from '../../packages/core/src/index';

function fixture(kind: 'line' | 'show') {
  const project = createDemoProject(kind);
  project.audio.assets = [{id: 'audio-fixture', name: 'Synthetic tone', mimeType: 'audio/wav', durationSeconds: 1, sizeBytes: 100, localUri: 'file:///private/test.wav'}];
  return project;
}
const fixtures = [fixture('line'), fixture('show')];
if (process.argv[2] === '--fixture') process.stdout.write(JSON.stringify(fixtures));
else {
  if (!process.argv[2]) throw new Error('Pass --fixture or a JSON file containing [{silent,media},...].');
  const results = JSON.parse(readFileSync(process.argv[2], 'utf8')) as {silent: Project; media: Project}[];
  assert.equal(results.length, fixtures.length);
  results.forEach((result, index) => {
    const source = fixtures[index]!;
    for (const viewer of [result.silent, result.media]) {
      assertValidProject(viewer);
      assert.deepEqual(viewer.notes, []);
      assert.ok(viewer.lifts.every(lift => lift.note === ''));
      assert.ok(!JSON.stringify(viewer).includes('file:///'));
      for (let t = 0; t <= projectDuration(source); t += 0.25) {
        assert.deepEqual(evaluateScene(viewer, t), evaluateScene(source, t));
      }
    }
    assert.deepEqual(result.silent.audio, {assets: [], clips: []});
    assert.equal(result.media.audio.assets.length, 1);
  });
  process.stdout.write('PASS: 2 SQL publication roundtrips; both media modes Core-valid; identical scenes every 0.25 s; notes and local URIs removed.\n');
}
