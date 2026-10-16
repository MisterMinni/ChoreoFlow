import { assertValidProject, evaluateScene, formationStartTime, formatCounts, projectDuration, type Project } from '@choreoflow/core';
import { PDF_FONT_BASE64, PDF_FONT_GLYPHS } from './font';

export function exportFilename(name: string): string { return `${Array.from(name).map(c => c.codePointAt(0)! < 32 ? '-' : c).join('').replace(/[<>:"/\\|?*]/g, '-').trim().slice(0, 120) || 'Choreografie'}.pdf`; }
const timeLabel = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
function readableText(color: string): string {
  const rgb = [1, 3, 5].map(start => { const v = parseInt(color.slice(start, start + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722 > 0.18 ? '#101827' : '#ffffff';
}

/** A real vector PDF, shared by browser and native filesystem adapters. No HTML execution. */
export async function buildProjectPdf(project: Project): Promise<Uint8Array> {
  assertValidProject(project);
  const supported = new Set(PDF_FONT_GLYPHS);
  const strings = [project.name, ...project.formations.map(f => f.name), ...project.people.flatMap(p => [p.name, p.label])];
  for (const value of strings) for (const character of value) {
    if (!supported.has(character.codePointAt(0)!) && !/\s/.test(character)) throw new Error(`Die PDF-Schrift unterstützt das Zeichen „${character}“ noch nicht. Bitte für diese Namen zunächst die vollständige Projektdatei exportieren.`);
  }
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS('DejaVuSans.ttf', PDF_FONT_BASE64);
  pdf.addFont('DejaVuSans.ttf', 'DejaVu', 'normal'); pdf.setFont('DejaVu');
  pdf.setProperties({ title: project.name, subject: 'Formationsübersicht', creator: 'ChoreoFlow', keywords: 'Choreografie, Formationen' });
  const width = 297, height = 210, margin = 16;
  const ink = '#19253c', muted = '#65758c', blue = '#3366ef';
  const title = (heading: string, subtitle: string): number => {
    pdf.setTextColor(muted); pdf.setFontSize(9);
    const shortName = project.name.length > 100 ? `${project.name.slice(0, 100)}…` : project.name;
    pdf.text(shortName.replace(/\s+/g, ' '), margin, 13);
    pdf.setTextColor(ink); pdf.setFontSize(18);
    const lines = pdf.splitTextToSize(heading.replace(/\s+/g, ' '), width - margin * 2) as string[];
    pdf.text(lines, margin, 25, { lineHeightFactor: 1.12 });
    const bottom = 25 + (lines.length - 1) * 7;
    pdf.setFontSize(9); pdf.setTextColor(muted); pdf.text(subtitle, margin, bottom + 9);
    return bottom + 17;
  };
  for (let formationIndex = 0; formationIndex < project.formations.length; formationIndex++) {
    if (formationIndex) pdf.addPage();
    const formation = project.formations[formationIndex]!, time = formationStartTime(project, formation.id), scene = evaluateScene(project, time);
    const top = title(`${String(formationIndex + 1).padStart(2, '0')}  ${formation.name}`, `${timeLabel(time)}  |  ${formatCounts(project.tempo, time)}  |  ${formation.holdSeconds.toFixed(2)} s halten  |  ${project.people.length} Personen`);
    const clusters: number[][] = [];
    scene.people.forEach((pose, index) => {
      const found = clusters.find(cluster => { const other = scene.people[cluster[0]!]!; return Math.hypot(pose.position.x - other.position.x, pose.position.y - other.position.y) < 0.005; });
      if (found) found.push(index); else clusters.push([index]);
    });
    const overlaps = clusters.filter(cluster => cluster.length > 1).map(cluster => cluster.map(i => i + 1).join('/'));
    pdf.setFontSize(8);
    const overlapLines = overlaps.length ? pdf.splitTextToSize(`Gleiche Position in der Draufsicht: ${overlaps.join('; ')}`, width - margin * 2) as string[] : [];
    const box = { left: margin + 8, top: top + 3, width: width - margin * 2 - 16, height: height - top - 43 - overlapLines.length * 4 };
    const minX = Math.min(-project.stage.width / 2 - 0.6, ...scene.people.map(p => p.position.x - 0.6));
    const maxX = Math.max(project.stage.width / 2 + 0.6, ...scene.people.map(p => p.position.x + 0.6));
    const minY = Math.min(-project.stage.depth / 2 - 0.6, ...scene.people.map(p => p.position.y - 0.6));
    const maxY = Math.max(project.stage.depth / 2 + 0.6, ...scene.people.map(p => p.position.y + 0.6));
    const scale = Math.min(box.width / (maxX - minX), box.height / (maxY - minY));
    const originX = box.left + box.width / 2 - (minX + maxX) / 2 * scale;
    const originY = box.top + box.height / 2 + (minY + maxY) / 2 * scale;
    const point = (x: number, y: number): [number, number] => [originX + x * scale, originY - y * scale];
    const stageTopLeft = point(-project.stage.width / 2, project.stage.depth / 2);
    pdf.setFillColor('#f6f8fc'); pdf.setDrawColor('#9cabc0'); pdf.setLineWidth(0.4);
    pdf.rect(stageTopLeft[0], stageTopLeft[1], project.stage.width * scale, project.stage.depth * scale, 'FD');
    pdf.setDrawColor('#dfe6ef'); pdf.setLineWidth(0.15);
    const grid = Math.max(project.stage.gridSize, Math.max(project.stage.width, project.stage.depth) / 30);
    for (let x = Math.ceil(-project.stage.width / 2 / grid) * grid; x < project.stage.width / 2; x += grid) {
      const a = point(x, -project.stage.depth / 2), b = point(x, project.stage.depth / 2); pdf.line(...a, ...b);
    }
    for (let y = Math.ceil(-project.stage.depth / 2 / grid) * grid; y < project.stage.depth / 2; y += grid) {
      const a = point(-project.stage.width / 2, y), b = point(project.stage.width / 2, y); pdf.line(...a, ...b);
    }
    const frontA = point(-project.stage.width / 2, -project.stage.depth / 2), frontB = point(project.stage.width / 2, -project.stage.depth / 2);
    pdf.setDrawColor(blue); pdf.setLineWidth(0.9); pdf.line(...frontA, ...frontB);
    for (const prop of project.props.filter(p => time >= p.startSeconds && time < p.endSeconds)) {
      const angle = prop.rotationDegrees * Math.PI / 180;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => point(prop.position.x + dx! * prop.size.x / 2 * Math.cos(angle) - dy! * prop.size.y / 2 * Math.sin(angle), prop.position.y + dx! * prop.size.x / 2 * Math.sin(angle) + dy! * prop.size.y / 2 * Math.cos(angle)));
      pdf.setDrawColor('#667085'); pdf.setLineWidth(0.5);
      corners.forEach((a, i) => { const b = corners[(i + 1) % corners.length]!; pdf.line(...a, ...b); });
    }
    for (const cluster of clusters) {
      const personIndex = cluster[0]!;
      const pose = scene.people[personIndex]!, person = project.people[personIndex]!, p = point(pose.position.x, pose.position.y);
      const radius = cluster.length > 1 ? 4 : Math.min(3.2, Math.max(2.1, scale * person.radius));
      pdf.setFillColor(person.color); pdf.setDrawColor('#ffffff'); pdf.setLineWidth(0.35); pdf.circle(...p, radius, 'FD');
      const marker = cluster.length <= 3 ? cluster.map(i => i + 1).join('/') : `${personIndex + 1}+`;
      pdf.setFontSize(marker.length > 4 ? 5.7 : marker.length > 2 ? 6.3 : 7.5); pdf.setTextColor(readableText(person.color)); pdf.text(marker, p[0], p[1] + 0.85, { align: 'center' });
      for (const memberIndex of cluster) {
        const radians = scene.people[memberIndex]!.facingDeg * Math.PI / 180;
        pdf.setDrawColor(project.people[memberIndex]!.color); pdf.setLineWidth(0.65);
        pdf.line(p[0] + Math.sin(radians) * (radius + 0.4), p[1] + Math.cos(radians) * (radius + 0.4), p[0] + Math.sin(radians) * (radius + 2), p[1] + Math.cos(radians) * (radius + 2));
      }
    }
    if (overlapLines.length) { pdf.setTextColor(muted); pdf.setFontSize(8); pdf.text(overlapLines, width / 2, height - 33 - (overlapLines.length - 1) * 3.6, { align: 'center', lineHeightFactor: 1.25 }); }
    pdf.setTextColor(blue); pdf.setFontSize(10); pdf.text('PUBLIKUM / VORDERKANTE', width / 2, height - 26, { align: 'center' });
    pdf.setTextColor(muted); pdf.setFontSize(8); pdf.text(`Bühne ${project.stage.width} × ${project.stage.depth} m · Nummern siehe Besetzung · Striche zeigen die Blickrichtung`, width / 2, height - 20, { align: 'center' });
  }
  // One shared roster avoids shrinking 100 names into a tiny diagram legend.
  pdf.addPage();
  let rosterTop = title('Besetzung', `${project.people.length} Personen  |  ${project.formations.length} Formationen  |  Gesamtdauer ${timeLabel(projectDuration(project))}`);
  let column = 0, y = rosterTop;
  const columnWidth = 122;
  for (let i = 0; i < project.people.length; i++) {
    const person = project.people[i]!;
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(`${person.label}  ·  ${person.name}`.replace(/\s+/g, ' '), columnWidth - 17) as string[];
    const itemHeight = Math.max(10, lines.length * 4.8 + 4);
    if (y + itemHeight > height - 23) {
      if (column === 0) { column = 1; y = rosterTop; }
      else { pdf.addPage(); rosterTop = title('Besetzung · Fortsetzung', 'Die Nummern gelten in allen Formationsgrafiken.'); column = 0; y = rosterTop; }
    }
    const x = margin + column * (columnWidth + 13);
    pdf.setFillColor(person.color); pdf.circle(x + 3.5, y + 1.5, 3.3, 'F');
    pdf.setTextColor(readableText(person.color)); pdf.setFontSize(i >= 99 ? 6.5 : 8); pdf.text(String(i + 1), x + 3.5, y + 2.4, { align: 'center' });
    pdf.setTextColor(ink); pdf.setFontSize(10); pdf.text(lines, x + 11, y + 2, { lineHeightFactor: 1.35 });
    y += itemHeight;
  }
  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page); pdf.setDrawColor('#dfe6ef'); pdf.setLineWidth(0.2); pdf.line(margin, height - 13, width - margin, height - 13);
    pdf.setFontSize(7.5); pdf.setTextColor(muted); pdf.text('Formationsübersicht · Planungsdarstellung', margin, height - 8); pdf.text(`${page} / ${totalPages}`, width - margin, height - 8, { align: 'right' });
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
