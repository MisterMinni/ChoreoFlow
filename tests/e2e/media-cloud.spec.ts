import { createHash } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import type { Project, ProjectHistory } from '../../packages/core/src/index';
import { installCloudFixture, loginCloudFixture } from './cloud-fixture';

type AudioWindow = Window & { __cloudAudio?: HTMLMediaElement };
type Workspace = { projects: Project[]; histories: Record<string, ProjectHistory>; settings: Record<string, unknown> };
async function localWorkspace(page: Page): Promise<Workspace> {
  return page.evaluate(() => new Promise<Workspace>((resolve, reject) => {
    const request = indexedDB.open('choreoflow-local-v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result, transaction = database.transaction('workspace', 'readonly');
      const read = transaction.objectStore('workspace').get('local:development');
      transaction.oncomplete = () => { database.close(); resolve(JSON.parse(read.result as string) as Workspace); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  }));
}
async function observePlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { (window as AudioWindow).__cloudAudio = this; return original.call(this); };
  });
}
async function blockUnmockedNetwork(page: Page): Promise<string[]> {
  const unexpected: string[] = [];
  // Installed before the synthetic cloud route: only that route can fulfill
  // cloud requests; no external service receives a real login or media request.
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    unexpected.push(route.request().url()); return route.abort('blockedbyclient');
  });
  return unexpected;
}

test('private Cloudmusik wird bytegleich als separate Arbeitskopie wiederhergestellt und nach Reload abgespielt', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const unexpected = await blockUnmockedNetwork(page);
  const fixture = await installCloudFixture(page, { role: 'reader', audio: true });
  await observePlayback(page);
  test.skip(!(await loginCloudFixture(page)), 'Cloud ist in diesem Webexport nicht konfiguriert.');
  const before = await localWorkspace(page);
  expect(before.projects.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Mit Musik als Arbeitskopie öffnen', exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/project-/);
  await expect(page.getByText('Lokal gespeichert', { exact: true })).toBeVisible();
  const restored = await localWorkspace(page), copy = restored.projects.find(project => project.name === fixture.snapshot.name)!;
  expect(copy).toBeDefined(); expect(copy.id).not.toBe(fixture.snapshot.id);
  expect(restored.projects).toHaveLength(before.projects.length + 1);
  for (const original of before.projects) {
    expect(restored.projects.find(project => project.id === original.id)).toEqual(original);
    expect(restored.histories[original.id]).toEqual(before.histories[original.id]);
  }
  expect(copy.audio.clips).toEqual(fixture.snapshot.audio.clips);
  expect(copy.audio.assets[0]).toEqual({ ...fixture.snapshot.audio.assets[0], localUri: 'choreoflow-audio://audio-test.wav' });
  expect(restored.settings[`origin:${copy.id}`]).toEqual({ userId: fixture.userId, cloudProjectId: fixture.cloudId, remoteProjectId: fixture.snapshot.id, revision: 5 });
  const cached = await page.evaluate(() => new Promise<{ digest: string; size: number; mime: string; id: string }>((resolve, reject) => {
    const opening = indexedDB.open('choreoflow-media-v1');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const database = opening.result, transaction = database.transaction('audio', 'readonly'), read = transaction.objectStore('audio').get('audio-test');
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.oncomplete = () => {
        database.close(); const stored = read.result as { asset: { id: string }; blob: Blob };
        void stored.blob.arrayBuffer().then(bytes => crypto.subtle.digest('SHA-256', bytes)).then(hash => resolve({ digest: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''), size: stored.blob.size, mime: stored.blob.type, id: stored.asset.id }), reject);
      };
    };
  }));
  expect(cached).toEqual({ digest: createHash('sha256').update(fixture.bytes).digest('hex'), size: fixture.bytes.length, mime: 'audio/wav', id: 'audio-test' });
  const download = fixture.calls.find(call => call.path.startsWith('/storage/v1/object/'))!;
  expect(download.path).toBe(`/storage/v1/object/project-media/${fixture.ownerId}/${fixture.cloudId}/audio-test`);
  expect(download.authorization).toBe(fixture.calls.find(call => call.path === '/auth/v1/user')!.authorization);
  expect(download.authorization).toMatch(/^Bearer ey/);
  const downloadsBeforeReload = fixture.calls.filter(call => call.path.startsWith('/storage/')).length;
  await page.reload();
  await page.getByRole('button', { name: 'Projektmenü', exact: true }).click();
  await page.getByRole('button', { name: 'Musik', exact: true }).click();
  await expect(page.getByText('cloud-test.wav', { exact: true })).toBeVisible();
  await expect(page.getByText(/2.00 s Original/)).toBeVisible();
  await page.getByRole('button', { name: 'Abspielen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => { const audio = (window as AudioWindow).__cloudAudio; return Boolean(audio && !audio.paused && audio.currentTime > 0.15); }), { intervals: [50] }).toBe(true);
  const playback = await page.evaluate(() => { const audio = (window as AudioWindow).__cloudAudio!; return { uri: audio.currentSrc, duration: audio.duration }; });
  expect(playback.uri).toMatch(/^blob:/); expect(playback.duration).toBeCloseTo(2, 2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(fixture.calls.filter(call => call.path.startsWith('/storage/'))).toHaveLength(downloadsBeforeReload);
  expect((await localWorkspace(page)).projects.find(project => project.id === copy.id)).toEqual(copy);
  expect(unexpected).toEqual([]); expect(errors).toEqual([]);
});

test('abgeschnittene Cloudmusik erzeugt keine Arbeitskopie und verändert vorhandene Entwürfe nicht', async ({ page }) => {
  const unexpected = await blockUnmockedNetwork(page);
  const fixture = await installCloudFixture(page, { audio: true, truncated: true });
  test.skip(!(await loginCloudFixture(page)), 'Cloud ist in diesem Webexport nicht konfiguriert.');
  const before = await localWorkspace(page);
  await page.getByRole('button', { name: 'Mit Musik als Arbeitskopie öffnen', exact: true }).click();
  await expect(page.getByText('Die Cloud-Musik ist unvollständig oder passt nicht zum Projekt.', { exact: true })).toBeVisible();
  expect(page.url()).not.toContain('/editor/');
  const after = await localWorkspace(page);
  expect(after.projects).toEqual(before.projects); expect(after.histories).toEqual(before.histories); expect(after.settings).toEqual(before.settings);
  expect(fixture.calls.filter(call => call.path.startsWith('/storage/'))).toHaveLength(1);
  expect(unexpected).toEqual([]);
});
