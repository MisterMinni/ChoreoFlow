import type { Project } from '@choreoflow/core';
import { buildProjectPdf, exportFilename } from './buildPdf';
export async function exportPdf(project: Project): Promise<void> {
  const bytes = await buildProjectPdf(project);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = exportFilename(project.name); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
