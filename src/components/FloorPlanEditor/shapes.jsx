import {
  Line, Rect, Circle, Arc, Text, Group, Ellipse,
} from "react-konva";
import { GRID, WALL_W } from "./constants";
import {
  snapV, pxToReal, buildWallOutline, polyBounds,
  insertVertex, removeVertex,
} from "./utils";
import VertexEditor from "./VertexEditor";

// ─── Wall ─────────────────────────────────────────────────────────────────────
export function WallShape({ wall, isSelected, onSelect, onChange, onSwitchToSelect, isMovable, mmPerPx }) {
  // Support both new {points:[...]} and legacy {x1,y1,x2,y2} formats
  const pts = wall.points ?? [wall.x1, wall.y1, wall.x2, wall.y2];
  // thick stored as mm on wall object; fallback to WALL_W*2 px if not set
  const thickPx = wall.thick && mmPerPx
    ? Math.max(2, Math.round(wall.thick / mmPerPx))
    : WALL_W * 2;
  const outlinePts = buildWallOutline(pts, thickPx);

  const handleDragEnd = (e) => {
    const ox = e.target.x(), oy = e.target.y();
    e.target.position({ x: 0, y: 0 });
    const moved = [];
    for (let i = 0; i < pts.length; i += 2)
      moved.push(snapV(pts[i] + ox), snapV(pts[i + 1] + oy));
    onChange?.(wall.id, { points: moved });
  };

  return (
    <>
      <Line
        name="wall"
        points={outlinePts} closed
        fill={isSelected ? "#BFDBFE" : "#334155"}
        stroke={isSelected ? "#3B82F6" : "#1E293B"}
        strokeWidth={isSelected ? 1.5 : 0.5}
        hitStrokeWidth={12}
        draggable={!!isMovable}
        onClick={() => onSelect(wall.id)}
        onTap={() => onSelect(wall.id)}
        onDragStart={() => onSwitchToSelect?.()}
        onDragEnd={handleDragEnd}
        shadowEnabled={isSelected}
        shadowColor="rgba(59,130,246,0.4)"
        shadowBlur={6}
      />
      {isSelected && (
        <VertexEditor
          points={pts}
          closed={false}
          minVerts={2}
          onChange={(newPts) => onChange?.(wall.id, { points: newPts })}
          onMidpointClick={(i) => onChange?.(wall.id, { points: insertVertex(pts, i, false) })}
          onVertexDblClick={(i) => {
            if (pts.length / 2 > 2) onChange?.(wall.id, { points: removeVertex(pts, i) });
          }}
        />
      )}
    </>
  );
}

// ─── Door ─────────────────────────────────────────────────────────────────────
export function DoorShape({ door, isSelected, onSelect, onChange, onSwitchToSelect }) {
  const size = door.size || 60, flip = door.flip ? -1 : 1;
  return (
    <Group
      x={door.x} y={door.y} rotation={door.rotation || 0}
      draggable
      onClick={() => onSelect(door.id)}
      onDragStart={() => onSwitchToSelect?.()}
      onDragEnd={(e) => onChange(door.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })}
    >
      {/* Wall gap cover */}
      <Rect x={-2} y={-WALL_W / 2 - 1} width={size + 4} height={WALL_W + 2} fill="white" listening={false} />
      {/* Door leaf */}
      <Line points={[0, 0, size, 0]} stroke={isSelected ? "#2563EB" : "#475569"} strokeWidth={2} />
      {/* Door swing arc — fill transparent so full sector is clickable */}
      <Arc
        x={0} y={0}
        innerRadius={0} outerRadius={size}
        angle={90}
        rotation={flip < 0 ? -90 : 0}
        scaleY={flip}
        fill="rgba(219,234,254,0.35)"
        stroke={isSelected ? "#3B82F6" : "#94A3B8"}
        strokeWidth={1} dash={[4, 3]}
      />
      {isSelected && (
        <Rect
          x={-4} y={-size - 4} width={size + 8} height={size + 8}
          fill="transparent" stroke="#3B82F6" strokeWidth={1} dash={[4, 3]} listening={false}
        />
      )}
    </Group>
  );
}

// ─── Window ───────────────────────────────────────────────────────────────────
export function WindowShape({ win, isSelected, onSelect, onChange, onSwitchToSelect }) {
  const size = win.size || 80;
  return (
    <Group
      x={win.x} y={win.y} rotation={win.rotation || 0}
      draggable
      onClick={() => onSelect(win.id)}
      onDragStart={() => onSwitchToSelect?.()}
      onDragEnd={(e) => onChange(win.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })}
    >
      <Rect x={0} y={-WALL_W / 2} width={size} height={WALL_W}
        fill="#BAE6FD" stroke={isSelected ? "#3B82F6" : "#64748B"} strokeWidth={isSelected ? 2 : 1} />
      {[1 / 3, 2 / 3].map((t, i) => (
        <Line key={i} points={[size * t, -WALL_W / 2, size * t, WALL_W / 2]}
          stroke={isSelected ? "#3B82F6" : "#0EA5E9"} strokeWidth={1.5} />
      ))}
    </Group>
  );
}

// ─── Room ─────────────────────────────────────────────────────────────────────
export function RoomShape({ room, isSelected, onSelect, onChange, mmPerPx, onSwitchToSelect }) {
  // Support both new {points:[...]} and legacy {x,y,width,height} formats
  const pts = room.points ?? [
    room.x, room.y,
    room.x + room.width, room.y,
    room.x + room.width, room.y + room.height,
    room.x, room.y + room.height,
  ];
  const bounds = polyBounds(pts);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const handleDragEnd = (e) => {
    const ox = e.target.x(), oy = e.target.y();
    e.target.position({ x: 0, y: 0 });
    const moved = [];
    for (let i = 0; i < pts.length; i += 2)
      moved.push(snapV(pts[i] + ox), snapV(pts[i + 1] + oy));
    onChange(room.id, { points: moved });
  };

  return (
    <>
      <Line
        name="room"
        points={pts} closed
        fill={room.fill}
        stroke={isSelected ? "#2563EB" : room.stroke}
        strokeWidth={isSelected ? 2 : 1}
        opacity={0.9}
        shadowEnabled={isSelected} shadowColor="rgba(37,99,235,0.15)" shadowBlur={8}
        draggable
        onClick={() => onSelect(room.id)}
        onTap={() => onSelect(room.id)}
        onDragStart={() => onSwitchToSelect?.()}
        onDragEnd={handleDragEnd}
      />
      {room.name && bounds.height > 32 && (
        <Text
          x={cx - (bounds.width - 12) / 2} y={cy - (bounds.height > 50 ? 14 : 7)}
          width={bounds.width - 12} text={room.name}
          fontSize={Math.min(13, bounds.width / 8)} fontStyle="bold"
          fontFamily="'Segoe UI',system-ui" fill={room.stroke} align="center" listening={false}
        />
      )}
      {bounds.width > 60 && bounds.height > 48 && (
        <Text
          x={cx - (bounds.width - 12) / 2} y={cy + 4}
          width={bounds.width - 12}
          text={`${pxToReal(bounds.width, mmPerPx)} × ${pxToReal(bounds.height, mmPerPx)}`}
          fontSize={9} fontFamily="monospace" fill={room.stroke}
          align="center" opacity={0.65} listening={false}
        />
      )}
      {isSelected && (
        <VertexEditor
          points={pts}
          closed={true}
          minVerts={3}
          onChange={(newPts) => onChange(room.id, { points: newPts })}
          onMidpointClick={(i) => onChange(room.id, { points: insertVertex(pts, i, true) })}
          onVertexDblClick={(i) => {
            if (pts.length / 2 > 3) onChange(room.id, { points: removeVertex(pts, i) });
          }}
        />
      )}
    </>
  );
}

// ─── Boundary (Khung gốc) ─────────────────────────────────────────────────────
// listening=true only in select mode (passed from index.jsx)
export function BoundaryShape({ points, isSelected, onSelect, onChange, listening }) {
  return (
    <>
      <Line
        name="boundary"
        points={points} closed
        fillEnabled={false}          // interior NOT hittable — only the stroke line
        stroke={isSelected ? "#3B82F6" : "#1E293B"}
        strokeWidth={isSelected ? 3 : 2}
        hitStrokeWidth={14}
        listening={!!listening}      // ignore events unless in select mode
        onClick={(e) => { e.cancelBubble = true; onSelect("__boundary__"); }}
        onTap={(e) => { e.cancelBubble = true; onSelect("__boundary__"); }}
        shadowEnabled={isSelected}
        shadowColor="rgba(59,130,246,0.3)"
        shadowBlur={8}
      />
      {isSelected && (
        <VertexEditor
          points={points}
          closed={true}
          minVerts={3}
          onChange={onChange}
          onMidpointClick={(i) => onChange(insertVertex(points, i, true))}
          onVertexDblClick={(i) => {
            if (points.length / 2 > 3) onChange(removeVertex(points, i));
          }}
        />
      )}
    </>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────
export function LabelShape({ label, isSelected, onSelect, onChange, onSwitchToSelect }) {
  const w = (label.text?.length || 4) * 7 + 16;
  return (
    <Group
      x={label.x} y={label.y}
      draggable
      onClick={() => onSelect(label.id)}
      onDragStart={() => onSwitchToSelect?.()}
      onDragEnd={(e) => onChange(label.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })}
    >
      <Rect x={-4} y={-4} width={w} height={22}
        fill={isSelected ? "#DBEAFE" : "rgba(255,255,255,0.92)"}
        stroke={isSelected ? "#3B82F6" : "#CBD5E1"} strokeWidth={1} cornerRadius={3} />
      <Text text={label.text} fontSize={12} fontStyle="bold"
        fontFamily="'Segoe UI',system-ui" fill="#1E293B" />
    </Group>
  );
}

// ─── Dimension ────────────────────────────────────────────────────────────────
export function DimensionShape({ dim, isSelected, onSelect, mmPerPx }) {
  const dx = dim.x2 - dim.x1, dy = dim.y2 - dim.y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const text = pxToReal(len, mmPerPx);
  const mx = (dim.x1 + dim.x2) / 2, my = (dim.y1 + dim.y2) / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const off = 18, nx = (-dy / len) * off, ny = (dx / len) * off;
  return (
    <Group onClick={() => onSelect(dim.id)}>
      <Line
        points={[dim.x1 + nx, dim.y1 + ny, dim.x2 + nx, dim.y2 + ny]}
        stroke={isSelected ? "#3B82F6" : "#64748B"} strokeWidth={1.5} hitStrokeWidth={8}
      />
      {[[dim.x1, dim.y1], [dim.x2, dim.y2]].map(([x, y], i) => (
        <Line key={i}
          points={[x + nx * 0.4, y + ny * 0.4, x + nx * 1.6, y + ny * 1.6]}
          stroke={isSelected ? "#3B82F6" : "#64748B"} strokeWidth={1.5} listening={false}
        />
      ))}
      <Group x={mx + nx} y={my + ny} rotation={angle}>
        <Rect x={-24} y={-9} width={48} height={14} fill="white" cornerRadius={3}
          stroke={isSelected ? "#3B82F6" : "#CBD5E1"} strokeWidth={1} listening={false} />
        <Text text={text} fontSize={9} fontStyle="bold" fontFamily="monospace"
          fill={isSelected ? "#2563EB" : "#475569"}
          x={-22} y={-7} width={44} align="center" listening={false}
        />
      </Group>
    </Group>
  );
}
