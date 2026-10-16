import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoProject } from '@choreoflow/core';
import { buildProjectPdf, exportFilename } from './buildPdf';

test('PDF is a real multipage file and leaves the project unchanged', async () => {
  const project = createDemoProject('show');
  project.name = 'Bühnenübersicht · Ελληνικά · Кириллица'; project.people[0]!.name = 'Zoë Müller';
  const before = JSON.stringify(project), bytes = await buildProjectPdf(project), document = Buffer.from(bytes).toString('latin1');
  assert.ok(document.startsWith('%PDF-')); assert.equal((document.match(/\/Type\s*\/Page\b/g) ?? []).length, 5);
  assert.equal(JSON.stringify(project), before); assert.ok(bytes.length > 1000); assert.ok(bytes.length < 300000);
  assert.ok(!document.includes('/JavaScript'));
});

test('100-person roster flows onto additional pages instead of shrinking names', async () => {
  const project = createDemoProject('stress'); project.formations = project.formations.slice(0, 2); project.transitions = project.transitions.slice(0, 1);
  project.people[0]!.name = 'Ein sehr langer Teilnehmername mit zusätzlichen Worten für einen mehrzeiligen Eintrag';
  const document = Buffer.from(await buildProjectPdf(project)).toString('latin1');
  assert.ok((document.match(/\/Type\s*\/Page\b/g) ?? []).length >= 6);
});

test('Unsupported glyphs produce an actionable error instead of a damaged name', async () => {
  const project = createDemoProject('line'); project.people[0]!.name = '测试';
  await assert.rejects(() => buildProjectPdf(project), /PDF-Schrift unterstützt/);
});

test('PDF filename removes path separators and control characters without losing umlauts', () => {
  assert.equal(exportFilename('Änne/Probe\n1'), 'Änne-Probe-1.pdf'); assert.equal(exportFilename('   '), 'Choreografie.pdf');
});
