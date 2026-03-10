import { useState, useRef, useEffect, useCallback, useReducer } from "react";
import {
  Stage,
  Layer,
  Line,
  Rect,
  Circle,
  Arc,
  Text,
  Group,
  Transformer,
} from "react-konva";

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID = 20;
const WALL_W = 4;
const ORIGIN_X = 72;
const ORIGIN_Y = 56;

const SCALE_PRESETS = [
  { label: "1:20", mmPerPx: 20 },
  { label: "1:50", mmPerPx: 50 },
  { label: "1:100", mmPerPx: 100 },
  { label: "1:200", mmPerPx: 200 },
];

const ROOM_COLORS = [
  { fill: "#EFF6FF", stroke: "#3B82F6", name: "Xanh" },
  { fill: "#F0FDF4", stroke: "#16A34A", name: "Xanh lá" },
  { fill: "#FEFCE8", stroke: "#CA8A04", name: "Vàng" },
  { fill: "#FFF1F2", stroke: "#E11D48", name: "Hồng" },
  { fill: "#F5F3FF", stroke: "#7C3AED", name: "Tím" },
  { fill: "#FFF7ED", stroke: "#EA580C", name: "Cam" },
  { fill: "#F0FDFA", stroke: "#0D9488", name: "Ngọc" },
  { fill: "#FDF4FF", stroke: "#C026D3", name: "Hồng tím" },
];

const IOT_TYPES = [
  { type: "sensor", icon: "📡", color: "#0891B2", label: "Sensor" },
  { type: "camera", icon: "📷", color: "#7C3AED", label: "Camera" },
  { type: "light", icon: "💡", color: "#D97706", label: "Đèn" },
  { type: "ac", icon: "❄️", color: "#2563EB", label: "Điều hòa" },
  { type: "lock", icon: "🔒", color: "#059669", label: "Khóa" },
  { type: "motion", icon: "🚶", color: "#DC2626", label: "Cảm biến" },
  { type: "smoke", icon: "🔥", color: "#EA580C", label: "Báo khói" },
  { type: "speaker", icon: "🔊", color: "#4F46E5", label: "Loa" },
];

const TOOLS = [
  { key: "select", icon: "↖", label: "Chọn", shortcut: "V" },
  { key: "wall", icon: "╋", label: "Tường", shortcut: "W" },
  { key: "room", icon: "□", label: "Phòng", shortcut: "R" },
  { key: "door", icon: "⌒", label: "Cửa đi", shortcut: "D" },
  { key: "window", icon: "⊟", label: "Cửa sổ", shortcut: "S" },
  { key: "iot", icon: "◉", label: "IoT", shortcut: "I" },
  { key: "label", icon: "T", label: "Nhãn", shortcut: "L" },
  { key: "dimension", icon: "↔", label: "Kích thước", shortcut: "M" },
  { key: "erase", icon: "✕", label: "Xóa", shortcut: "E" },
];

let _id = 1000;
const uid = () => `e${_id++}`;
const snapV = (v) => Math.round(v / GRID) * GRID;

function pxToReal(px, mmPerPx) {
  const mm = Math.round(px * mmPerPx);
  return mm >= 1000 ? `${(mm / 1000).toFixed(1)}m` : `${mm}mm`;
}

function snapAngle(x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const snapped = Math.round(ang / 45) * 45;
  const rad = (snapped * Math.PI) / 180;
  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: snapV(x1 + Math.cos(rad) * len),
    y: snapV(y1 + Math.sin(rad) * len),
  };
}

// ─── History Reducer ─────────────────────────────────────────────────────────
const INIT_STATE = {
  walls: [],
  rooms: [],
  doors: [],
  windows: [],
  iotDevs: [],
  labels: [],
  dims: [],
};

function historyReducer(state, action) {
  const { past, present, future } = state;
  switch (action.type) {
    case "PUSH": {
      const newPresent = { ...present, ...action.payload };
      return {
        past: [...past.slice(-49), present],
        present: newPresent,
        future: [],
      };
    }
    case "UNDO": {
      if (!past.length) return state;
      const prev = past[past.length - 1];
      return {
        past: past.slice(0, -1),
        present: prev,
        future: [present, ...future],
      };
    }
    case "REDO": {
      if (!future.length) return state;
      const next = future[0];
      return {
        past: [...past, present],
        present: next,
        future: future.slice(1),
      };
    }
    default:
      return state;
  }
}

// ─── Setup Dialog ─────────────────────────────────────────────────────────────
function SetupDialog({ onStart }) {
  const [widthM, setWidthM] = useState(9);
  const [heightM, setHeightM] = useState(10);
  const [scaleIdx, setScaleIdx] = useState(2);
  const [floors, setFloors] = useState(1);
  const preset = SCALE_PRESETS[scaleIdx];
  const canvasW = Math.round((widthM * 1000) / preset.mmPerPx);
  const canvasH = Math.round((heightM * 1000) / preset.mmPerPx);

  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gray-900 px-6 py-5">
          <h1 className="text-white font-bold text-lg tracking-tight">
            Tạo mặt bằng mới
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Nhập kích thước thực tế của ngôi nhà
          </p>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Chiều rộng (m)", val: widthM, set: setWidthM },
              { label: "Chiều dài (m)", val: heightM, set: setHeightM },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
                  {label}
                </label>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={val}
                  onChange={(e) => set(+e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 text-xl font-bold rounded-xl px-4 py-3 border-2 border-gray-200 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Floors */}
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
              Số tầng
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((f) => (
                <button
                  key={f}
                  onClick={() => setFloors(f)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                    floors === f
                      ? "bg-gray-900 border-gray-900 text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Scale */}
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
              Tỉ lệ bản vẽ
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SCALE_PRESETS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setScaleIdx(i)}
                  className={`px-4 py-3 rounded-xl text-left border-2 transition-all ${
                    scaleIdx === i
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p
                    className={`font-bold text-base ${scaleIdx === i ? "text-blue-600" : "text-gray-800"}`}
                  >
                    {s.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    1 ô ={" "}
                    {GRID * s.mmPerPx >= 1000
                      ? `${((GRID * s.mmPerPx) / 1000).toFixed(1)}m`
                      : `${GRID * s.mmPerPx}mm`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Canvas:{" "}
              <span className="font-mono font-bold text-gray-800">
                {canvasW} × {canvasH} px
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Kích thước:{" "}
              <span className="font-bold text-gray-800">
                {widthM}m × {heightM}m
              </span>
              <span className="text-gray-400 ml-1 text-xs">(rộng × dài)</span>
            </div>
          </div>

          <button
            onClick={() =>
              onStart({
                widthMm: widthM * 1000,
                heightMm: heightM * 1000,
                mmPerPx: preset.mmPerPx,
                scaleLabel: preset.label,
                floors,
              })
            }
            className="bg-gray-900 hover:bg-gray-700 text-white font-bold text-base rounded-xl py-3.5 transition-all"
          >
            Bắt đầu thiết kế →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
function GridLayer({ stageW, stageH }) {
  const lines = [];
  for (let x = 0; x <= stageW; x += GRID) {
    const maj = x % (GRID * 5) === 0;
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, stageH]}
        stroke={maj ? "#CBD5E1" : "#EEF2F7"}
        strokeWidth={maj ? 0.7 : 0.4}
        listening={false}
      />,
    );
  }
  for (let y = 0; y <= stageH; y += GRID) {
    const maj = y % (GRID * 5) === 0;
    lines.push(
      <Line
        key={`h${y}`}
        points={[0, y, stageW, y]}
        stroke={maj ? "#CBD5E1" : "#EEF2F7"}
        strokeWidth={maj ? 0.7 : 0.4}
        listening={false}
      />,
    );
  }
  return <Layer listening={false}>{lines}</Layer>;
}

// ─── House Frame ─────────────────────────────────────────────────────────────
function HouseFrame({ widthPx, heightPx, mmPerPx, scaleLabel }) {
  const ox = ORIGIN_X,
    oy = ORIGIN_Y;
  const step = GRID * 5;
  const ticks = [];

  for (let x = 0; x <= widthPx; x += step) {
    const label = pxToReal(x, mmPerPx);
    ticks.push(
      <Group key={`rx${x}`} listening={false}>
        <Line
          points={[ox + x, oy - 10, ox + x, oy]}
          stroke="#94A3B8"
          strokeWidth={1}
        />
        <Text
          text={label}
          x={ox + x - 20}
          y={oy - 26}
          width={40}
          align="center"
          fontSize={9}
          fill="#94A3B8"
          fontFamily="monospace"
        />
      </Group>,
    );
  }
  for (let y = 0; y <= heightPx; y += step) {
    const label = pxToReal(y, mmPerPx);
    ticks.push(
      <Group key={`ry${y}`} listening={false}>
        <Line
          points={[ox - 10, oy + y, ox, oy + y]}
          stroke="#94A3B8"
          strokeWidth={1}
        />
        <Text
          text={label}
          x={ox - 52}
          y={oy + y - 7}
          width={40}
          align="right"
          fontSize={9}
          fill="#94A3B8"
          fontFamily="monospace"
        />
      </Group>,
    );
  }

  return (
    <Layer listening={false}>
      {/* outer gray */}
      <Rect
        x={0}
        y={0}
        width={ox + widthPx + 120}
        height={oy + heightPx + 60}
        fill="#F1F5F9"
      />
      {/* floor white */}
      <Rect x={ox} y={oy} width={widthPx} height={heightPx} fill="white" />
      {/* border */}
      <Rect
        x={ox}
        y={oy}
        width={widthPx}
        height={heightPx}
        stroke="#1E293B"
        strokeWidth={2}
        fill="transparent"
      />
      {/* dim lines */}
      <Line
        points={[ox, oy - 38, ox + widthPx, oy - 38]}
        stroke="#94A3B8"
        strokeWidth={1}
      />
      <Line
        points={[ox - 44, oy, ox - 44, oy + heightPx]}
        stroke="#94A3B8"
        strokeWidth={1}
      />
      {/* width badge */}
      <Group x={ox + widthPx / 2} y={oy - 52}>
        <Rect
          x={-32}
          y={-9}
          width={64}
          height={18}
          fill="#1E293B"
          cornerRadius={4}
        />
        <Text
          text={pxToReal(widthPx, mmPerPx)}
          x={-30}
          y={-7}
          width={60}
          align="center"
          fontSize={10}
          fontStyle="bold"
          fill="white"
          fontFamily="monospace"
        />
      </Group>
      {/* height badge */}
      <Group x={ox - 58} y={oy + heightPx / 2} rotation={-90}>
        <Rect
          x={-32}
          y={-9}
          width={64}
          height={18}
          fill="#1E293B"
          cornerRadius={4}
        />
        <Text
          text={pxToReal(heightPx, mmPerPx)}
          x={-30}
          y={-7}
          width={60}
          align="center"
          fontSize={10}
          fontStyle="bold"
          fill="white"
          fontFamily="monospace"
        />
      </Group>
      {/* scale */}
      <Group x={ox + widthPx + 8} y={oy}>
        <Rect
          x={0}
          y={0}
          width={54}
          height={18}
          fill="#E2E8F0"
          cornerRadius={4}
        />
        <Text
          text={`Tỉ lệ ${scaleLabel}`}
          x={2}
          y={4}
          width={50}
          align="center"
          fontSize={9}
          fill="#64748B"
          fontFamily="monospace"
        />
      </Group>
      {ticks}
    </Layer>
  );
}

// ─── Live Dim Label ───────────────────────────────────────────────────────────
function LiveDimLabel({ x1, y1, x2, y2, mmPerPx }) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return null;
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const wLabel = pxToReal(Math.abs(dx), mmPerPx);
  const hLabel = pxToReal(Math.abs(dy), mmPerPx);
  const text =
    dx !== 0 && dy !== 0
      ? `${pxToReal(len, mmPerPx)}`
      : dx !== 0
        ? wLabel
        : hLabel;

  return (
    <Group x={mx} y={my - 24} listening={false}>
      <Rect
        x={-36}
        y={-10}
        width={72}
        height={20}
        fill="#1E293B"
        cornerRadius={5}
        opacity={0.9}
      />
      <Text
        text={text}
        x={-34}
        y={-7}
        width={68}
        align="center"
        fontSize={10}
        fontStyle="bold"
        fill="#F8FAFC"
        fontFamily="monospace"
      />
    </Group>
  );
}

// ─── Wall ─────────────────────────────────────────────────────────────────────
function WallShape({ wall, isSelected, onSelect }) {
  const dx = wall.x2 - wall.x1,
    dy = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len,
    ny = dx / len;
  const hw = WALL_W / 2;
  const pts = [
    wall.x1 + nx * hw,
    wall.y1 + ny * hw,
    wall.x2 + nx * hw,
    wall.y2 + ny * hw,
    wall.x2 - nx * hw,
    wall.y2 - ny * hw,
    wall.x1 - nx * hw,
    wall.y1 - ny * hw,
  ];
  return (
    <Line
      points={pts}
      closed
      fill={isSelected ? "#BFDBFE" : "#334155"}
      stroke={isSelected ? "#3B82F6" : "#1E293B"}
      strokeWidth={isSelected ? 1.5 : 0.5}
      hitStrokeWidth={12}
      onClick={() => onSelect(wall.id)}
      onTap={() => onSelect(wall.id)}
      shadowEnabled={isSelected}
      shadowColor="rgba(59,130,246,0.4)"
      shadowBlur={6}
    />
  );
}

// ─── Door ─────────────────────────────────────────────────────────────────────
function DoorShape({ door, isSelected, onSelect, onChange, mode }) {
  const size = door.size || 60,
    flip = door.flip ? -1 : 1;
  return (
    <Group
      x={door.x}
      y={door.y}
      rotation={door.rotation || 0}
      draggable={mode === "select"}
      onClick={() => onSelect(door.id)}
      onDragEnd={(e) =>
        onChange(door.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })
      }
    >
      <Rect
        x={-2}
        y={-WALL_W / 2 - 1}
        width={size + 4}
        height={WALL_W + 2}
        fill="white"
        listening={false}
      />
      <Line
        points={[0, 0, size, 0]}
        stroke={isSelected ? "#2563EB" : "#475569"}
        strokeWidth={2}
      />
      <Arc
        x={0}
        y={0}
        innerRadius={0}
        outerRadius={size}
        angle={90}
        rotation={flip < 0 ? -90 : 0}
        scaleY={flip}
        stroke={isSelected ? "#3B82F6" : "#94A3B8"}
        strokeWidth={1}
        dash={[4, 3]}
      />
      {isSelected && (
        <Rect
          x={-4}
          y={-size - 4}
          width={size + 8}
          height={size + 8}
          fill="transparent"
          stroke="#3B82F6"
          strokeWidth={1}
          dash={[4, 3]}
          listening={false}
        />
      )}
    </Group>
  );
}

// ─── Window ───────────────────────────────────────────────────────────────────
function WindowShape({ win, isSelected, onSelect, onChange, mode }) {
  const size = win.size || 80;
  return (
    <Group
      x={win.x}
      y={win.y}
      rotation={win.rotation || 0}
      draggable={mode === "select"}
      onClick={() => onSelect(win.id)}
      onDragEnd={(e) =>
        onChange(win.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })
      }
    >
      <Rect
        x={0}
        y={-WALL_W / 2}
        width={size}
        height={WALL_W}
        fill="#BAE6FD"
        stroke={isSelected ? "#3B82F6" : "#64748B"}
        strokeWidth={isSelected ? 2 : 1}
      />
      {[1 / 3, 2 / 3].map((t, i) => (
        <Line
          key={i}
          points={[size * t, -WALL_W / 2, size * t, WALL_W / 2]}
          stroke={isSelected ? "#3B82F6" : "#0EA5E9"}
          strokeWidth={1.5}
        />
      ))}
    </Group>
  );
}

// ─── Room ─────────────────────────────────────────────────────────────────────
function RoomShape({ room, isSelected, onSelect, onChange, mode, mmPerPx }) {
  const rectRef = useRef(),
    trRef = useRef();
  useEffect(() => {
    if (isSelected && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Rect
        ref={rectRef}
        x={room.x}
        y={room.y}
        width={room.width}
        height={room.height}
        fill={room.fill}
        stroke={isSelected ? "#2563EB" : room.stroke}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={1}
        opacity={0.9}
        shadowEnabled={isSelected}
        shadowColor="rgba(37,99,235,0.15)"
        shadowBlur={8}
        draggable={mode === "select"}
        onClick={() => onSelect(room.id)}
        onDragEnd={(e) =>
          onChange(room.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })
        }
        onTransformEnd={() => {
          const n = rectRef.current,
            sx = n.scaleX(),
            sy = n.scaleY();
          n.scaleX(1);
          n.scaleY(1);
          onChange(room.id, {
            x: snapV(n.x()),
            y: snapV(n.y()),
            width: snapV(Math.max(GRID * 2, n.width() * sx)),
            height: snapV(Math.max(GRID * 2, n.height() * sy)),
          });
        }}
      />
      {room.name && room.height > 32 && (
        <Text
          x={room.x + 6}
          y={room.y + room.height / 2 - (room.height > 50 ? 14 : 7)}
          width={room.width - 12}
          text={room.name}
          fontSize={Math.min(13, room.width / 8)}
          fontStyle="bold"
          fontFamily="'Segoe UI',system-ui"
          fill={room.stroke}
          align="center"
          listening={false}
        />
      )}
      {room.width > 60 && room.height > 48 && (
        <Text
          x={room.x + 6}
          y={room.y + room.height / 2 + 4}
          width={room.width - 12}
          text={`${pxToReal(room.width, mmPerPx)} × ${pxToReal(room.height, mmPerPx)}`}
          fontSize={9}
          fontFamily="monospace"
          fill={room.stroke}
          align="center"
          opacity={0.65}
          listening={false}
        />
      )}
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]}
          anchorStyleFunc={(anchor) => {
            anchor.cornerRadius(2);
            anchor.fill("#3B82F6");
            anchor.stroke("#fff");
            anchor.strokeWidth(1.5);
          }}
          boundBoxFunc={(_, nb) => ({
            ...nb,
            width: Math.max(GRID * 2, nb.width),
            height: Math.max(GRID * 2, nb.height),
          })}
        />
      )}
    </>
  );
}

// ─── IoT ─────────────────────────────────────────────────────────────────────
function IotMarker({ device, isSelected, onSelect, onChange, mode }) {
  const t = IOT_TYPES.find((x) => x.type === device.type) || IOT_TYPES[0];
  return (
    <Group
      x={device.x}
      y={device.y}
      draggable={mode === "select"}
      onClick={() => onSelect(device.id)}
      onDragEnd={(e) =>
        onChange(device.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })
      }
    >
      <Circle
        radius={14}
        fill={isSelected ? t.color : "white"}
        stroke={t.color}
        strokeWidth={isSelected ? 2.5 : 2}
        shadowEnabled
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={6}
      />
      <Text text={t.icon} fontSize={12} x={-7} y={-8} listening={false} />
      {isSelected && (
        <Circle
          radius={19}
          fill="transparent"
          stroke={t.color}
          strokeWidth={1.5}
          dash={[4, 3]}
          listening={false}
        />
      )}
    </Group>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────
function LabelShape({ label, isSelected, onSelect, onChange, mode }) {
  const w = (label.text?.length || 4) * 7 + 16;
  return (
    <Group
      x={label.x}
      y={label.y}
      draggable={mode === "select"}
      onClick={() => onSelect(label.id)}
      onDragEnd={(e) =>
        onChange(label.id, { x: snapV(e.target.x()), y: snapV(e.target.y()) })
      }
    >
      <Rect
        x={-4}
        y={-4}
        width={w}
        height={22}
        fill={isSelected ? "#DBEAFE" : "rgba(255,255,255,0.92)"}
        stroke={isSelected ? "#3B82F6" : "#CBD5E1"}
        strokeWidth={1}
        cornerRadius={3}
      />
      <Text
        text={label.text}
        fontSize={12}
        fontStyle="bold"
        fontFamily="'Segoe UI',system-ui"
        fill="#1E293B"
      />
    </Group>
  );
}

// ─── Dimension ────────────────────────────────────────────────────────────────
function DimensionShape({ dim, isSelected, onSelect, mmPerPx }) {
  const dx = dim.x2 - dim.x1,
    dy = dim.y2 - dim.y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const text = pxToReal(len, mmPerPx);
  const mx = (dim.x1 + dim.x2) / 2,
    my = (dim.y1 + dim.y2) / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const off = 18,
    nx = (-dy / len) * off,
    ny = (dx / len) * off;
  return (
    <Group onClick={() => onSelect(dim.id)}>
      <Line
        points={[dim.x1 + nx, dim.y1 + ny, dim.x2 + nx, dim.y2 + ny]}
        stroke={isSelected ? "#3B82F6" : "#64748B"}
        strokeWidth={1.5}
        hitStrokeWidth={8}
        listening={false}
      />
      {[
        [dim.x1, dim.y1],
        [dim.x2, dim.y2],
      ].map(([x, y], i) => (
        <Line
          key={i}
          points={[x + nx * 0.4, y + ny * 0.4, x + nx * 1.6, y + ny * 1.6]}
          stroke={isSelected ? "#3B82F6" : "#64748B"}
          strokeWidth={1.5}
          listening={false}
        />
      ))}
      <Group x={mx + nx} y={my + ny} rotation={angle}>
        <Rect
          x={-24}
          y={-9}
          width={48}
          height={14}
          fill="white"
          cornerRadius={3}
          stroke={isSelected ? "#3B82F6" : "#CBD5E1"}
          strokeWidth={1}
          listening={false}
        />
        <Text
          text={text}
          fontSize={9}
          fontStyle="bold"
          fontFamily="monospace"
          fill={isSelected ? "#2563EB" : "#475569"}
          x={-22}
          y={-7}
          width={44}
          align="center"
          listening={false}
        />
      </Group>
    </Group>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
export default function FloorPlanEditor() {
  const [config, setConfig] = useState(null);
  const [currentFloor, setCurrentFloor] = useState(1);

  // ── Per-floor independent history storage ─────────────────────────────────
  // Each floor has its own { past, present, future }
  const [allFloorHistories, setAllFloorHistories] = useState({
    1: { past: [], present: INIT_STATE, future: [] },
  });

  // Current floor's history
  const floorHistory = allFloorHistories[currentFloor] || {
    past: [],
    present: INIT_STATE,
    future: [],
  };

  const updateFloorHistory = useCallback((floorNum, updater) => {
    setAllFloorHistories((prev) => ({
      ...prev,
      [floorNum]: updater(
        prev[floorNum] || { past: [], present: INIT_STATE, future: [] },
      ),
    }));
  }, []);

  const pushScene = useCallback(
    (patch) => {
      updateFloorHistory(currentFloor, (h) => ({
        past: [...h.past.slice(-49), h.present],
        present: { ...h.present, ...patch },
        future: [],
      }));
    },
    [currentFloor, updateFloorHistory],
  );

  const undo = useCallback(() => {
    updateFloorHistory(currentFloor, (h) => {
      if (!h.past.length) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      };
    });
  }, [currentFloor, updateFloorHistory]);

  const redo = useCallback(() => {
    updateFloorHistory(currentFloor, (h) => {
      if (!h.future.length) return h;
      return {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      };
    });
  }, [currentFloor, updateFloorHistory]);

  const scene = floorHistory.present;
  const canUndo = floorHistory.past.length > 0;
  const canRedo = floorHistory.future.length > 0;

  const { walls, rooms, doors, windows, iotDevs, labels, dims } = scene;

  const setWalls = (fn) => pushScene({ walls: fn(walls) });
  const setRooms = (fn) => pushScene({ rooms: fn(rooms) });
  const setDoors = (fn) => pushScene({ doors: fn(doors) });
  const setWindows = (fn) => pushScene({ windows: fn(windows) });
  const setIot = (fn) => pushScene({ iotDevs: fn(iotDevs) });
  const setLabels = (fn) => pushScene({ labels: fn(labels) });
  const setDims = (fn) => pushScene({ dims: fn(dims) });

  // ── Tool state ────────────────────────────────────────────────────────────
  const [tool, setTool] = useState("select");
  const [selectedId, setSelId] = useState(null);
  const [iotType, setIotType] = useState("sensor");
  const [roomColor, setRoomColor] = useState(0);
  const [roomName, setRoomName] = useState("");
  const [doorSize, setDoorSize] = useState(60);
  const [winSize, setWinSize] = useState(80);
  const [labelText, setLabelText] = useState("Nhãn");
  const [viewScale, setViewScale] = useState(1);

  const [drawStart, setDrawStart] = useState(null);
  const [drawCur, setDrawCur] = useState(null);
  const [dimStart, setDimStart] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const stageRef = useRef();

  // ── Config derived ────────────────────────────────────────────────────────
  const widthPx = config ? Math.round(config.widthMm / config.mmPerPx) : 0;
  const heightPx = config ? Math.round(config.heightMm / config.mmPerPx) : 0;
  const stageW = config ? widthPx + ORIGIN_X + 100 : 800;
  const stageH = config ? heightPx + ORIGIN_Y + 80 : 600;

  const clamp = (x, y) => ({
    x: snapV(Math.max(ORIGIN_X, Math.min(ORIGIN_X + widthPx, x))),
    y: snapV(Math.max(ORIGIN_Y, Math.min(ORIGIN_Y + heightPx, y))),
  });

  const getPos = useCallback(
    (e) => {
      const p = e.target.getStage().getPointerPosition();
      return clamp(p.x, p.y);
    },
    [widthPx, heightPx],
  );

  // ── Floor switching ───────────────────────────────────────────────────────
  const switchFloor = (f) => {
    // Each floor stores its own history in allFloorHistories
    // Just init the floor if it doesn't exist yet
    setAllFloorHistories((prev) => ({
      ...prev,
      [f]: prev[f] || { past: [], present: INIT_STATE, future: [] },
    }));
    setCurrentFloor(f);
    setSelId(null);
    setDrawStart(null);
    setDimStart(null);
  };

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e) => {
      const p = getPos(e);
      if (tool === "select" && e.target === e.target.getStage()) {
        setSelId(null);
        return;
      }

      if (tool === "wall") {
        setDrawStart(p);
        setDrawCur(p);
        return;
      }
      if (tool === "room") {
        setDrawStart(p);
        setDrawCur(p);
        return;
      }
      if (tool === "dimension") {
        if (!dimStart) {
          setDimStart(p);
        } else {
          setDims((d) => [
            ...d,
            { id: uid(), x1: dimStart.x, y1: dimStart.y, x2: p.x, y2: p.y },
          ]);
          setDimStart(null);
        }
        return;
      }
      if (tool === "door") {
        setDoors((d) => [
          ...d,
          {
            id: uid(),
            x: p.x,
            y: p.y,
            size: doorSize,
            rotation: 0,
            flip: false,
          },
        ]);
        return;
      }
      if (tool === "window") {
        setWindows((d) => [
          ...d,
          { id: uid(), x: p.x, y: p.y, size: winSize, rotation: 0 },
        ]);
        return;
      }
      if (tool === "iot") {
        setIot((d) => [...d, { id: uid(), type: iotType, x: p.x, y: p.y }]);
        return;
      }
      if (tool === "label") {
        setLabels((d) => [
          ...d,
          { id: uid(), x: p.x, y: p.y, text: labelText },
        ]);
        return;
      }
    },
    [tool, getPos, dimStart, doorSize, winSize, iotType, labelText],
  );

  const onMouseMove = useCallback(
    (e) => {
      const p = e.target.getStage().getPointerPosition();
      setMousePos({ x: snapV(p.x), y: snapV(p.y) });
      if (!drawStart) return;
      const cp = clamp(p.x, p.y);
      if (tool === "wall")
        setDrawCur(snapAngle(drawStart.x, drawStart.y, cp.x, cp.y));
      else setDrawCur(cp);
    },
    [drawStart, tool, clamp],
  );

  const onMouseUp = useCallback(() => {
    if (!drawStart || !drawCur) return;
    if (tool === "wall") {
      const dx = drawCur.x - drawStart.x,
        dy = drawCur.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > GRID)
        setWalls((w) => [
          ...w,
          {
            id: uid(),
            x1: drawStart.x,
            y1: drawStart.y,
            x2: drawCur.x,
            y2: drawCur.y,
          },
        ]);
    }
    if (tool === "room") {
      const w = Math.abs(drawCur.x - drawStart.x),
        h = Math.abs(drawCur.y - drawStart.y);
      if (w >= GRID * 2 && h >= GRID * 2) {
        const c = ROOM_COLORS[roomColor];
        setRooms((r) => [
          ...r,
          {
            id: uid(),
            x: Math.min(drawStart.x, drawCur.x),
            y: Math.min(drawStart.y, drawCur.y),
            width: w,
            height: h,
            name: roomName,
            fill: c.fill,
            stroke: c.stroke,
          },
        ]);
      }
    }
    setDrawStart(null);
    setDrawCur(null);
  }, [drawStart, drawCur, tool, roomColor, roomName]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const upd = (setter) => (id, p) =>
    setter((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const updRoom = upd(setRooms),
    updDoor = upd(setDoors),
    updWin = upd(setWindows),
    updIot = upd(setIot),
    updLabel = upd(setLabels);

  const deleteById = useCallback(
    (id) => {
      [
        setWalls,
        setRooms,
        setDoors,
        setWindows,
        setIot,
        setLabels,
        setDims,
      ].forEach((s) => s((a) => a.filter((x) => x.id !== id)));
      if (selectedId === id) setSelId(null);
    },
    [selectedId],
  );

  const deleteSelected = useCallback(
    () => deleteById(selectedId),
    [deleteById, selectedId],
  );

  const handleSelect = useCallback(
    (id) => {
      if (tool === "erase") {
        deleteById(id);
        return;
      }
      setSelId(id);
    },
    [tool, deleteById],
  );

  const rotateSelected = () => {
    const d = doors.find((x) => x.id === selectedId);
    if (d) {
      updDoor(selectedId, { rotation: (d.rotation + 90) % 360 });
      return;
    }
    const w = windows.find((x) => x.id === selectedId);
    if (w) updWin(selectedId, { rotation: (w.rotation + 90) % 360 });
  };
  const flipDoor = () => {
    const d = doors.find((x) => x.id === selectedId);
    if (d) updDoor(selectedId, { flip: !d.flip });
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Ctrl+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "z"))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        setTool("select");
        setDrawStart(null);
        setDimStart(null);
        return;
      }
      if (e.key === "r" || e.key === "R") {
        rotateSelected();
        return;
      }
      // Tool shortcuts
      const toolMap = {
        v: "select",
        w: "wall",
        r: "room",
        d: "door",
        s: "window",
        i: "iot",
        l: "label",
        m: "dimension",
        e: "erase",
      };
      const t = toolMap[e.key.toLowerCase()];
      if (t) {
        setTool(t);
        setSelId(null);
        setDrawStart(null);
        setDimStart(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, deleteSelected, selectedId, rotateSelected]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportPng = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = `floor_${currentFloor}.png`;
    a.click();
  };

  // ── Draw preview ──────────────────────────────────────────────────────────
  const renderPreview = () => {
    if (!drawStart || !drawCur) return null;
    if (tool === "wall")
      return (
        <>
          <Line
            points={[drawStart.x, drawStart.y, drawCur.x, drawCur.y]}
            stroke="#2563EB"
            strokeWidth={WALL_W}
            opacity={0.5}
            lineCap="round"
            listening={false}
          />
          <LiveDimLabel
            x1={drawStart.x}
            y1={drawStart.y}
            x2={drawCur.x}
            y2={drawCur.y}
            mmPerPx={config?.mmPerPx || 100}
          />
        </>
      );
    if (tool === "room") {
      const rx = Math.min(drawStart.x, drawCur.x),
        ry = Math.min(drawStart.y, drawCur.y);
      const rw = Math.abs(drawCur.x - drawStart.x),
        rh = Math.abs(drawCur.y - drawStart.y);
      const c = ROOM_COLORS[roomColor];
      return (
        <>
          <Rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            fill={c.fill}
            stroke={c.stroke}
            strokeWidth={1.5}
            dash={[6, 3]}
            opacity={0.7}
            listening={false}
          />
          <LiveDimLabel
            x1={drawStart.x}
            y1={drawStart.y}
            x2={drawCur.x}
            y2={drawCur.y}
            mmPerPx={config?.mmPerPx || 100}
          />
        </>
      );
    }
    return null;
  };

  const selRoom = rooms.find((r) => r.id === selectedId);
  const selDoor = doors.find((r) => r.id === selectedId);
  const selWin = windows.find((r) => r.id === selectedId);
  const selIot = iotDevs.find((r) => r.id === selectedId);
  const selLabel = labels.find((r) => r.id === selectedId);
  const hasSelection = !!(selRoom || selDoor || selWin || selIot || selLabel);

  const cursorMap = {
    select: "default",
    wall: "crosshair",
    room: "crosshair",
    door: "crosshair",
    window: "crosshair",
    iot: "copy",
    label: "text",
    dimension: "crosshair",
    erase: "not-allowed",
  };

  if (!config)
    return (
      <SetupDialog
        onStart={(c) => {
          setConfig(c);
          setCurrentFloor(1);
        }}
      />
    );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden select-none">
      {/* ── LEFT TOOLBAR ───────────────────────────────────────────────── */}
      <aside className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0 shadow-sm">
        {TOOLS.map(({ key, icon, label, shortcut }) => (
          <button
            key={key}
            title={`${label} (${shortcut})`}
            onClick={() => {
              setTool(key);
              setSelId(null);
              setDrawStart(null);
              setDimStart(null);
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all relative group ${
              tool === key
                ? key === "erase"
                  ? "bg-red-100 text-red-600"
                  : "bg-blue-100 text-blue-700 shadow-sm"
                : key === "erase"
                  ? "text-red-400 hover:bg-red-50"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <span className="font-mono text-sm leading-none">{icon}</span>
            {/* Tooltip */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 hidden group-hover:flex items-center gap-2 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
                {label}
                <span className="ml-2 bg-gray-700 px-1.5 py-0.5 rounded text-gray-300 font-mono text-xs">
                  {shortcut}
                </span>
              </div>
            </div>
          </button>
        ))}

        <div className="flex-1" />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Ctrl+Z"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all text-sm font-bold"
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Ctrl+Y"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all text-sm font-bold"
        >
          ↪
        </button>
      </aside>

      {/* ── CANVAS ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-200 px-4 h-11 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setConfig(null)}
            className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors"
          >
            ← New
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
            {config.scaleLabel}
          </span>
          <span className="text-xs text-gray-400">
            1 ô = {pxToReal(GRID, config.mmPerPx)}
          </span>

          {config.floors > 1 && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-gray-400 mr-1">Tầng:</span>
              {Array.from({ length: config.floors }, (_, i) => i + 1).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => switchFloor(f)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border ${
                      currentFloor === f
                        ? "bg-gray-900 border-gray-900 text-white"
                        : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Coords */}
          <span className="text-xs font-mono text-gray-300">
            {pxToReal(mousePos.x - ORIGIN_X, config.mmPerPx)},{" "}
            {pxToReal(mousePos.y - ORIGIN_Y, config.mmPerPx)}
          </span>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setViewScale((s) => Math.max(0.3, +(s - 0.1).toFixed(1)))
              }
              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold text-gray-600"
            >
              −
            </button>
            <button
              onClick={() => setViewScale(1)}
              className="text-xs text-gray-500 hover:text-gray-800 w-12 text-center font-mono"
            >
              {Math.round(viewScale * 100)}%
            </button>
            <button
              onClick={() =>
                setViewScale((s) => Math.min(3, +(s + 0.1).toFixed(1)))
              }
              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold text-gray-600"
            >
              +
            </button>
          </div>

          <button
            onClick={exportPng}
            className="bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold px-4 h-8 rounded-lg transition-all ml-1"
          >
            Xuất PNG ↓
          </button>

          {tool !== "select" && (
            <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-medium animate-pulse ml-1">
              {TOOLS.find((t) => t.key === tool)?.label}
              {dimStart ? " — Click điểm 2" : ""}
            </span>
          )}
        </div>

        {/* Floor Tab Bar */}
        {config.floors > 1 && (
          <div className="bg-white border-b border-gray-200 px-4 flex items-center gap-1 h-10 shrink-0">
            <span className="text-xs text-gray-400 font-medium mr-2">
              Tầng:
            </span>
            {Array.from({ length: config.floors }, (_, i) => i + 1).map((f) => {
              const hasData =
                allFloorHistories[f]?.present &&
                Object.values(allFloorHistories[f].present).some(
                  (arr) => arr.length > 0,
                );
              return (
                <button
                  key={f}
                  onClick={() => switchFloor(f)}
                  className={`relative px-4 h-8 rounded-lg text-sm font-semibold transition-all border ${
                    currentFloor === f
                      ? "bg-gray-900 border-gray-900 text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  Tầng {f}
                  {hasData && currentFloor !== f && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Stage */}
        <div className="flex-1 overflow-auto flex items-start justify-start p-6 bg-gray-100">
          <div
            style={{
              transform: `scale(${viewScale})`,
              transformOrigin: "top left",
              display: "inline-block",
            }}
          >
            <Stage
              ref={stageRef}
              width={stageW}
              height={stageH}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              style={{
                cursor: cursorMap[tool] || "default",
                borderRadius: "12px",
                boxShadow: "0 4px 32px rgba(0,0,0,0.12)",
              }}
            >
              <HouseFrame
                widthPx={widthPx}
                heightPx={heightPx}
                mmPerPx={config.mmPerPx}
                scaleLabel={config.scaleLabel}
              />
              <GridLayer stageW={stageW} stageH={stageH} />

              <Layer>
                {rooms.map((r) => (
                  <RoomShape
                    key={r.id}
                    room={r}
                    isSelected={selectedId === r.id}
                    onSelect={handleSelect}
                    onChange={updRoom}
                    mode={tool}
                    mmPerPx={config.mmPerPx}
                  />
                ))}
              </Layer>
              <Layer>
                {walls.map((w) => (
                  <WallShape
                    key={w.id}
                    wall={w}
                    isSelected={selectedId === w.id}
                    onSelect={handleSelect}
                    mode={tool}
                  />
                ))}
                {doors.map((d) => (
                  <DoorShape
                    key={d.id}
                    door={d}
                    isSelected={selectedId === d.id}
                    onSelect={handleSelect}
                    onChange={updDoor}
                    mode={tool}
                  />
                ))}
                {windows.map((w) => (
                  <WindowShape
                    key={w.id}
                    win={w}
                    isSelected={selectedId === w.id}
                    onSelect={handleSelect}
                    onChange={updWin}
                    mode={tool}
                  />
                ))}
                {dims.map((d) => (
                  <DimensionShape
                    key={d.id}
                    dim={d}
                    isSelected={selectedId === d.id}
                    onSelect={handleSelect}
                    mmPerPx={config.mmPerPx}
                  />
                ))}
                {renderPreview()}
                {dimStart && (
                  <Circle
                    x={dimStart.x}
                    y={dimStart.y}
                    radius={5}
                    fill="#3B82F6"
                    stroke="white"
                    strokeWidth={1.5}
                    listening={false}
                  />
                )}
              </Layer>
              <Layer>
                {iotDevs.map((d) => (
                  <IotMarker
                    key={d.id}
                    device={d}
                    isSelected={selectedId === d.id}
                    onSelect={handleSelect}
                    onChange={updIot}
                    mode={tool}
                  />
                ))}
                {labels.map((l) => (
                  <LabelShape
                    key={l.id}
                    label={l}
                    isSelected={selectedId === l.id}
                    onSelect={handleSelect}
                    onChange={updLabel}
                    mode={tool}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
      <aside className="w-56 bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-sm overflow-y-auto">
        {/* Tool options panel */}
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            {TOOLS.find((t) => t.key === tool)?.label}
          </p>

          {tool === "room" && (
            <div className="flex flex-col gap-2">
              <input
                className="w-full bg-gray-50 text-gray-900 text-sm rounded-xl px-3 py-2 border border-gray-200 outline-none focus:border-blue-400 transition-colors"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Tên phòng..."
              />
              <div className="flex flex-wrap gap-1.5">
                {ROOM_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setRoomColor(i)}
                    style={{ background: c.fill, borderColor: c.stroke }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${roomColor === i ? "scale-125 ring-2 ring-blue-400" : "hover:scale-110"}`}
                  />
                ))}
              </div>
            </div>
          )}

          {tool === "door" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Kích thước</span>
                <span className="font-mono font-bold text-gray-700">
                  {pxToReal(doorSize, config.mmPerPx)}
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={120}
                step={GRID}
                value={doorSize}
                onChange={(e) => setDoorSize(+e.target.value)}
                className="w-full accent-blue-500"
              />
            </div>
          )}

          {tool === "window" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Kích thước</span>
                <span className="font-mono font-bold text-gray-700">
                  {pxToReal(winSize, config.mmPerPx)}
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={160}
                step={GRID}
                value={winSize}
                onChange={(e) => setWinSize(+e.target.value)}
                className="w-full accent-blue-500"
              />
            </div>
          )}

          {tool === "iot" && (
            <div className="flex flex-col gap-1">
              {IOT_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setIotType(t.type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                    iotType === t.type
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  {iotType === t.type && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          )}

          {tool === "label" && (
            <input
              className="w-full bg-gray-50 text-gray-900 text-sm rounded-xl px-3 py-2 border border-gray-200 outline-none focus:border-blue-400"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="Nội dung nhãn..."
            />
          )}

          {tool === "select" && !hasSelection && (
            <p className="text-xs text-gray-400 italic">
              Click vào đối tượng để chọn
            </p>
          )}

          {tool === "wall" && (
            <p className="text-xs text-gray-400">Kéo để vẽ · Tự snap 45°/90°</p>
          )}
          {tool === "dimension" && (
            <p className="text-xs text-gray-400">
              {dimStart ? "Click điểm thứ 2" : "Click điểm đầu tiên"}
            </p>
          )}
          {tool === "erase" && (
            <p className="text-xs text-red-400">Click vào đối tượng để xóa</p>
          )}
        </div>

        {/* Selected object panel */}
        {hasSelection && tool === "select" && (
          <div className="p-3 border-b border-gray-100 flex flex-col gap-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Thuộc tính
            </p>

            {selRoom && (
              <>
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {selRoom.name || "(phòng)"}
                </p>
                <p className="text-xs font-mono text-gray-400">
                  {pxToReal(selRoom.width, config.mmPerPx)} ×{" "}
                  {pxToReal(selRoom.height, config.mmPerPx)}
                </p>
                {renaming === selRoom.id ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      className="flex-1 bg-gray-50 text-gray-900 text-xs rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updRoom(renaming, { name: renameVal });
                          setRenaming(null);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        updRoom(renaming, { name: renameVal });
                        setRenaming(null);
                      }}
                      className="bg-blue-600 text-white text-xs px-2.5 rounded-lg"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRenaming(selRoom.id);
                      setRenameVal(selRoom.name || "");
                    }}
                    className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 px-3 py-1.5 rounded-xl transition-all text-left"
                  >
                    ✏️ Đổi tên phòng
                  </button>
                )}
              </>
            )}

            {selDoor && (
              <>
                <p className="text-sm font-semibold text-gray-800">🚪 Cửa đi</p>
                <p className="text-xs font-mono text-gray-400">
                  {pxToReal(selDoor.size, config.mmPerPx)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={rotateSelected}
                    className="flex-1 text-xs border border-gray-200 hover:border-gray-400 text-gray-600 py-1.5 rounded-xl"
                  >
                    ↻ Xoay
                  </button>
                  <button
                    onClick={flipDoor}
                    className="flex-1 text-xs border border-gray-200 hover:border-gray-400 text-gray-600 py-1.5 rounded-xl"
                  >
                    ↔ Lật
                  </button>
                </div>
              </>
            )}

            {selWin && (
              <>
                <p className="text-sm font-semibold text-gray-800">🪟 Cửa sổ</p>
                <p className="text-xs font-mono text-gray-400">
                  {pxToReal(selWin.size, config.mmPerPx)}
                </p>
                <button
                  onClick={rotateSelected}
                  className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 py-1.5 rounded-xl"
                >
                  ↻ Xoay 90°
                </button>
              </>
            )}

            {selIot && (
              <>
                <p className="text-sm font-semibold text-gray-800">
                  {IOT_TYPES.find((t) => t.type === selIot.type)?.icon}{" "}
                  {IOT_TYPES.find((t) => t.type === selIot.type)?.label}
                </p>
                <p className="text-xs font-mono text-gray-400">
                  x:{selIot.x - ORIGIN_X} · y:{selIot.y - ORIGIN_Y}
                </p>
              </>
            )}

            {selLabel && (
              <>
                <p className="text-sm font-semibold text-gray-800">🏷️ Nhãn</p>
                {renaming === selLabel.id ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      className="flex-1 bg-gray-50 text-gray-900 text-xs rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updLabel(renaming, { text: renameVal });
                          setRenaming(null);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        updLabel(renaming, { text: renameVal });
                        setRenaming(null);
                      }}
                      className="bg-blue-600 text-white text-xs px-2.5 rounded-lg"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRenaming(selLabel.id);
                      setRenameVal(selLabel.text);
                    }}
                    className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 px-3 py-1.5 rounded-xl"
                  >
                    ✏️ Sửa nội dung
                  </button>
                )}
              </>
            )}

            <button
              onClick={deleteSelected}
              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-xl transition-all font-medium mt-1"
            >
              Xóa đối tượng
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="p-3 mt-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            Thống kê
          </p>
          {[
            ["Tường", walls.length],
            ["Phòng", rooms.length],
            ["Cửa đi", doors.length],
            ["Cửa sổ", windows.length],
            ["IoT", iotDevs.length],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center py-1">
              <span className="text-xs text-gray-500">{k}</span>
              <span className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {v}
              </span>
            </div>
          ))}
        </div>

        {/* Shortcuts */}
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            Phím tắt
          </p>
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Undo</span>
              <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                Ctrl+Z
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Redo</span>
              <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                Ctrl+Y
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Xoay</span>
              <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                R
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Xóa</span>
              <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                Del
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Hủy</span>
              <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                Esc
              </kbd>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
