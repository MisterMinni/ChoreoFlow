import { test, expect } from '@playwright/test';

type AudioTestWindow = Window & { __audioUnderTest?: HTMLMediaElement };

function generatedWav(): Buffer {
  const sampleRate = 22050, seconds = 2, samples = sampleRate * seconds;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 3000), 44 + i * 2);
  return buffer;
}

test('echter WAV-Import bleibt nach Reload erhalten und der getrimmte Player steuert die Projektzeit', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    // Observe the real browser player; retain its original implementation and decoding.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      (window as AudioTestWindow).__audioUnderTest = this;
      return play.call(this);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Projekt öffnen:/ }).first().click();
  await page.getByRole('button', { name: 'Projektmenü', exact: true }).click();
  await page.getByRole('button', { name: 'Musik', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('music-import').click();
  await (await chooser).setFiles({ name: 'choreoflow-generated-2s.wav', mimeType: 'audio/wav', buffer: generatedWav() });
  await expect(page.getByText('choreoflow-generated-2s.wav', { exact: true })).toBeVisible();
  await expect(page.getByText(/2.00 s Original/)).toBeVisible();
  for (const [label, value, summary] of [
    ['Anfang im Original (s)', '0.25', '1.75 s im Projekt · Start bei 0.00 s'],
    ['Ende im Original (s)', '1.75', '1.50 s im Projekt · Start bei 0.00 s'],
    ['Start in der Choreografie (s)', '0.5', '1.50 s im Projekt · Start bei 0.50 s'],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel(label, { exact: true }).press('Tab');
    await expect(page.getByText('Lokal gespeichert', { exact: true })).toBeVisible();
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('1.50 s im Projekt · Start bei 0.50 s', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Projektmenü', exact: true }).click();
  await page.getByRole('button', { name: 'Musik', exact: true }).click();
  await expect(page.getByText('choreoflow-generated-2s.wav', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Anfang im Original (s)', { exact: true })).toHaveValue('0.25');
  await expect(page.getByLabel('Ende im Original (s)', { exact: true })).toHaveValue('1.75');
  await page.getByRole('button', { name: 'Abspielen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const media = (window as AudioTestWindow).__audioUnderTest;
    return Boolean(media && !media.paused && media.currentTime > 0.3);
  }), { intervals: [50] }).toBe(true);
  const clock = await page.evaluate(() => {
    const media = (window as AudioTestWindow).__audioUnderTest!;
    const displayed = document.body.innerText.match(/(\d{2}):(\d{2}\.\d{2})\s*\/\s*\d{2}:/);
    return { source: media.currentTime, duration: media.duration, uri: media.currentSrc, timeline: displayed ? Number(displayed[1]) * 60 + Number(displayed[2]) : null };
  });
  expect(clock.duration).toBeCloseTo(2, 2); expect(clock.uri).toMatch(/^blob:/);
  expect(clock.timeline).not.toBeNull();
  expect(Math.abs(clock.timeline! - (clock.source - 0.25 + 0.5))).toBeLessThan(0.15);
  await expect.poll(() => page.evaluate(() => (window as AudioTestWindow).__audioUnderTest?.paused), { intervals: [50] }).toBe(true);
  const stoppedAt = await page.evaluate(() => (window as AudioTestWindow).__audioUnderTest!.currentTime);
  expect(stoppedAt).toBeGreaterThanOrEqual(1.72); expect(stoppedAt).toBeLessThan(1.85);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(errors).toEqual([]);
});
