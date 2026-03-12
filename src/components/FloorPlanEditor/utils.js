import { GRID, SNAP } from "./constants";

let _id = 1000;
export const uid = () => `e${_id++}`;

// Snap to SNAP unit (finer than GRID) for smoother wall/door placement
export const snapV = (v) => Math.round(v / SNAP) * SNAP;

export function pxToReal(px, mmPerPx) {
  const mm = Math.round(px * mmPerPx);
  return mm >= 1000 ? `${(mm / 1000).toFixed(1)}m` : `${mm}mm`;
}

export function snapAngle(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const snapped = Math.round(ang / 45) * 45;
  const rad = (snapped * Math.PI) / 180;
  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: snapV(x1 + Math.cos(rad) * len),
    y: snapV(y1 + Math.sin(rad) * len),
  };
}

// ─── Polygon / vertex helpers ────────────────────────────────────────────────

/** Convert flat [x0,y0,x1,y1,...] to [{x,y},...] */
export function flatToVerts(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i += 2) out.push({ x: pts[i], y: pts[i + 1] });
  return out;
}

/** Convert [{x,y},...] back to flat [x0,y0,...] */
export function vertsToFlat(verts) {
  return verts.flatMap((v) => [v.x, v.y]);
}

/** Bounding box of a flat polygon */
export function polyBounds(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i]     < minX) minX = pts[i];
    if (pts[i]     > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Midpoint of edge i→i+1 (wrapping for closed polygons) */
export function edgeMidpoint(pts, i, closed) {
  const n = pts.length / 2;
  const j = closed ? (i + 1) % n : Math.min(i + 1, n - 1);
  return {
    x: (pts[i * 2] + pts[j * 2]) / 2,
    y: (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2,
  };
}

/** Insert a new vertex (snapped midpoint) after edge index i */
export function insertVertex(pts, afterIndex, closed = true) {
  const n = pts.length / 2;
  const j = closed ? (afterIndex + 1) % n : Math.min(afterIndex + 1, n - 1);
  const mx = snapV((pts[afterIndex * 2] + pts[j * 2]) / 2);
  const my = snapV((pts[afterIndex * 2 + 1] + pts[j * 2 + 1]) / 2);
  const verts = flatToVerts(pts);
  verts.splice(afterIndex + 1, 0, { x: mx, y: my });
  return vertsToFlat(verts);
}

/** Remove vertex at index i */
export function removeVertex(pts, index) {
  const verts = flatToVerts(pts);
  verts.splice(index, 1);
  return vertsToFlat(verts);
}

/** Ray-casting point-in-polygon test */
export function pointInPolygon(px, py, pts) {
  const n = pts.length / 2;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1];
    const xj = pts[j * 2], yj = pts[j * 2 + 1];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Migrate old wall {x1,y1,x2,y2} to new {points:[...]} format */
export function migrateWall(w) {
  if (w.points) return w;
  return { id: w.id, points: [w.x1, w.y1, w.x2, w.y2] };
}

/** Migrate old room {x,y,width,height} to new {points:[...]} format */
export function migrateRoom(r) {
  if (r.points) return r;
  const { x, y, width, height } = r;
  return {
    id: r.id, name: r.name, fill: r.fill, stroke: r.stroke,
    points: [x, y, x + width, y, x + width, y + height, x, y + height],
  };
}

/** Build thick polyline outline polygon (miter joins) for wall rendering */
export function buildWallOutline(pts, wallW) {
  const hw = wallW / 2;
  const n = pts.length / 2;
  if (n < 2) return pts;

  // Compute unit normals for each segment (pointing "left")
  const normals = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[(i + 1) * 2] - pts[i * 2];
    const dy = pts[(i + 1) * 2 + 1] - pts[i * 2 + 1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    normals.push({ nx: -dy / len, ny: dx / len });
  }

  const leftPts = [], rightPts = [];

  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], y = pts[i * 2 + 1];
    let ox, oy;

    if (i === 0) {
      ox = normals[0].nx * hw;
      oy = normals[0].ny * hw;
    } else if (i === n - 1) {
      ox = normals[n - 2].nx * hw;
      oy = normals[n - 2].ny * hw;
    } else {
      const n1 = normals[i - 1], n2 = normals[i];
      const bx = n1.nx + n2.nx, by = n1.ny + n2.ny;
      const blen = Math.sqrt(bx * bx + by * by) || 1;
      const dot = n1.nx * n2.nx + n1.ny * n2.ny;
      const miterLen = hw / Math.max(0.2, Math.sqrt((1 + dot) / 2));
      const clampedMiter = Math.min(miterLen, hw * 4);
      ox = (bx / blen) * clampedMiter;
      oy = (by / blen) * clampedMiter;
    }

    leftPts.push(x + ox, y + oy);
    rightPts.push(x - ox, y - oy);
  }

  // Reverse rightPts as coordinate PAIRS (not individual numbers)
  const rightReversed = [];
  for (let i = rightPts.length - 2; i >= 0; i -= 2)
    rightReversed.push(rightPts[i], rightPts[i + 1]);

  return [...leftPts, ...rightReversed];
}
