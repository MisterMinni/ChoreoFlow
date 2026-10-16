import type { Id, MotionPath, Vec3 } from './model';

export const EPSILON = 1e-8;
export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const subtract = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const multiply = (a: Vec3, scalar: number): Vec3 => vec(a.x * scalar, a.y * scalar, a.z * scalar);
export const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, multiply(subtract(b, a), t));
export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
export function rotate(point: Vec3, pivot: Vec3, degrees: number): Vec3 {
  const radians = degrees * Math.PI / 180;
  const x = point.x - pivot.x, y = point.y - pivot.y;
  return vec(pivot.x + x * Math.cos(radians) - y * Math.sin(radians), pivot.y + x * Math.sin(radians) + y * Math.cos(radians), point.z);
}
export function centroid(points: Vec3[]): Vec3 {
  return points.length ? multiply(points.reduce(add, vec()), 1 / points.length) : vec();
}
export type TemplateType = 'line' | 'rows' | 'block' | 'circle' | 'semicircle' | 'v' | 'inverted-v' | 'diagonal' | 'double-diagonal';
export interface TemplateOptions { width?: number; depth?: number; center?: Vec3; orientationDegrees?: number; rows?: number }
export function generateTemplate(type: TemplateType, personIds: Id[], options: TemplateOptions = {}): Record<Id, Vec3> {
  const width = options.width ?? 8, depth = options.depth ?? 4, center = options.center ?? vec();
  const n = personIds.length, positions: Record<Id, Vec3> = {};
  const rows = Math.max(1, Math.min(n, Math.floor(options.rows ?? (type === 'block' ? Math.ceil(Math.sqrt(n)) : 2))));
  personIds.forEach((id, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    let p: Vec3;
    if (type === 'line') p = vec((t - 0.5) * width);
    else if (type === 'diagonal') p = vec((t - 0.5) * width, (t - 0.5) * depth);
    else if (type === 'v' || type === 'inverted-v') p = vec((t - 0.5) * width, (Math.abs(t - 0.5) * 2 - 0.5) * depth * (type === 'v' ? 1 : -1));
    else if (type === 'circle' || type === 'semicircle') {
      const angle = type === 'circle' ? 2 * Math.PI * i / n : Math.PI * t;
      p = n === 1 ? vec() : vec(Math.cos(angle) * width / 2, Math.sin(angle) * depth / 2);
    } else if (type === 'double-diagonal') {
      const half = Math.ceil(n / 2), side = i < half ? 0 : 1, j = side === 0 ? i : i - half;
      const count = side === 0 ? half : n - half, u = count <= 1 ? 0.5 : j / (count - 1);
      p = vec((u - 0.5) * width, (u - 0.5) * depth * (side === 0 ? 1 : -1));
    } else {
      const columns = Math.ceil(n / rows), row = Math.floor(i / columns), column = i % columns;
      const inRow = Math.min(columns, n - row * columns);
      p = vec(inRow <= 1 ? 0 : (column / (inRow - 1) - 0.5) * width, rows <= 1 ? 0 : (row / (rows - 1) - 0.5) * depth);
    }
    positions[id] = add(rotate(p, vec(), options.orientationDegrees ?? 0), center);
  });
  return positions;
}

/** Native parameter evaluation; polyline uses length proportional progress. */
function rawPath(path: MotionPath, start: Vec3, end: Vec3, t: number): Vec3 {
  if (path.type === 'line') return lerp(start, end, t);
  if (path.type === 'arc') return lerp(lerp(start, path.control, t), lerp(path.control, end, t), t);
  if (path.type === 'cubic') {
    const a = lerp(start, path.control1, t), b = lerp(path.control1, path.control2, t), c = lerp(path.control2, end, t);
    return lerp(lerp(a, b, t), lerp(b, c, t), t);
  }
  const points = [start, ...path.points, end];
  const lengths = points.slice(1).map((p, i) => distance(points[i]!, p));
  let remainder = lengths.reduce((a, b) => a + b, 0) * t;
  for (let i = 0; i < lengths.length; i++) {
    if (remainder <= lengths[i]! || i === lengths.length - 1) return lerp(points[i]!, points[i + 1]!, lengths[i]! <= EPSILON ? 0 : remainder / lengths[i]!);
    remainder -= lengths[i]!;
  }
  return end;
}
interface PathTable { parameters: number[]; lengths: number[]; total: number }
const pathCache = new WeakMap<MotionPath, Map<string, PathTable>>();
/** Adaptive chord table (0.1 mm local chord error, max depth 14). */
function pathTable(path: MotionPath, start: Vec3, end: Vec3): PathTable {
  const key = `${start.x},${start.y},${start.z}:${end.x},${end.y},${end.z}:${JSON.stringify(path)}`;
  let cache = pathCache.get(path);
  if (!cache) { cache = new Map(); pathCache.set(path, cache); }
  const existing = cache.get(key); if (existing) return existing;
  const parameters = [0], points = [start];
  const split = (a: number, b: number, pa: Vec3, pb: Vec3, depth: number): void => {
    const m = (a + b) / 2, pm = rawPath(path, start, end, m);
    const q1 = rawPath(path, start, end, (a + m) / 2), q3 = rawPath(path, start, end, (m + b) / 2);
    const polyLength = distance(pa, q1) + distance(q1, pm) + distance(pm, q3) + distance(q3, pb);
    // A small parameter interval also bounds speed variation on nearly straight
    // curves, whose chord error alone can be tiny despite uneven derivatives.
    if (depth < 14 && (polyLength - distance(pa, pb) > 0.0001 || b - a > 1 / 256)) {
      split(a, m, pa, pm, depth + 1); split(m, b, pm, pb, depth + 1);
    } else { parameters.push(b); points.push(pb); }
  };
  split(0, 1, start, end, 0);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1]! + distance(points[i - 1]!, points[i]!));
  const table = { parameters, lengths, total: lengths[lengths.length - 1]! };
  if (cache.size >= 64) cache.clear();
  cache.set(key, table); return table;
}
/** Arc-length remapping gives approximately constant physical speed on curves. */
export function evaluatePath(path: MotionPath, start: Vec3, end: Vec3, progress: number): Vec3 {
  const t = clamp(progress);
  if (path.type === 'line' || path.type === 'polyline') return rawPath(path, start, end, t);
  const table = pathTable(path, start, end); if (table.total <= EPSILON) return start;
  const desired = t * table.total;
  let low = 1, high = table.lengths.length - 1;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (table.lengths[mid]! < desired) low = mid + 1; else high = mid; }
  const a = low - 1, fraction = (desired - table.lengths[a]!) / (table.lengths[low]! - table.lengths[a]! || 1);
  return rawPath(path, start, end, table.parameters[a]! + fraction * (table.parameters[low]! - table.parameters[a]!));
}
export function pathLength(path: MotionPath, start: Vec3, end: Vec3): number {
  if (path.type === 'line') return distance(start, end);
  if (path.type === 'polyline') { const points = [start, ...path.points, end]; return points.slice(1).reduce((sum, p, i) => sum + distance(points[i]!, p), 0); }
  return pathTable(path, start, end).total;
}
/** Conservative derivative bound for the exact piecewise arc-length map above. */
export function pathSpeedBound(path: MotionPath, start: Vec3, end: Vec3): number {
  if (path.type === 'line' || path.type === 'polyline') return pathLength(path, start, end);
  const table = pathTable(path, start, end);
  const controls = path.type === 'arc' ? [start, path.control, end] : [start, path.control1, path.control2, end];
  const derivative = (controls.length - 1) * Math.max(...controls.slice(1).map((p, i) => distance(controls[i]!, p)));
  let parameterRate = 0;
  for (let i = 1; i < table.lengths.length; i++) {
    const delta = table.lengths[i]! - table.lengths[i - 1]!;
    if (delta > 0) parameterRate = Math.max(parameterRate, table.total * (table.parameters[i]! - table.parameters[i - 1]!) / delta);
  }
  return derivative * parameterRate;
}
