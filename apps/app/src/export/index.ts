import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Project } from '@choreoflow/core';
import { buildProjectPdf, exportFilename } from './buildPdf';
export async function exportPdf(project: Project): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Der Systemdialog zum Teilen von PDF-Dateien ist auf diesem Gerät nicht verfügbar.');
  const bytes = await buildProjectPdf(project), file = new File(Paths.cache, exportFilename(project.name));
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Formationsübersicht teilen' });
}
