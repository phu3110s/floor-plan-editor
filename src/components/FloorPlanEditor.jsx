import { useState, useRef, useEffect, useCallback } from "react";
import {
  Stage,
  Layer,
  Line,
  Rect,
  Circle,
  Arc,
  Text,
  Arrow,
  Group,
  Transformer,
} from "react-konva";

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 860;
const CANVAS_H = 620;
const GRID = 20;
const WALL_THICKNESS = 10;

const snap = (v) => Math.round(v / GRID) * GRID;
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const ROOM_COLORS = [
  { fill: "#EFF6FF", stroke: "#3B82F6", name: "Xanh" },
  { fill: "#F0FDF4", stroke: "#22C55E", name: "Xanh lá" },
  { fill: "#FEFCE8", stroke: "#EAB308", name: "Vàng" },
  { fill: "#FFF1F2", stroke: "#F43F5E", name: "Hồng" },
  { fill: "#F5F3FF", stroke: "#8B5CF6", name: "Tím" },
  { fill: "#FFF7ED", stroke: "#F97316", name: "Cam" },
  { fill: "#F0F9FF", stroke: "#0EA5E9", name: "Xanh nhạt" },
  { fill: "#FDF4FF", stroke: "#D946EF", name: "Hồng tím" },
];

const IOT_TYPES = [
  { type: "sensor", icon: "📡", color: "#06B6D4", label: "Sensor nhiệt độ" },
  { type: "camera", icon: "📷", color: "#8B5CF6", label: "Camera" },
  { type: "light", icon: "💡", color: "#F59E0B", label: "Đèn thông minh" },
  { type: "ac", icon: "❄️", color: "#3B82F6", label: "Điều hòa" },
  { type: "lock", icon: "🔒", color: "#10B981", label: "Khóa cửa" },
  {
    type: "motion",
    icon: "🚶",
    color: "#EF4444",
    label: "Cảm biến chuyển động",
  },
  { type: "smoke", icon: "🔥", color: "#F97316", label: "Báo khói" },
  { type: "speaker", icon: "🔊", color: "#6366F1", label: "Loa thông minh" },
];

const TOOLS = [
  { key: "select", icon: "⬆️", label: "Chọn / Di chuyển" },
  { key: "wall", icon: "🧱", label: "Vẽ tường" },
  { key: "room", icon: "⬛", label: "Vẽ phòng" },
  { key: "door", icon: "🚪", label: "Đặt cửa đi" },
  { key: "window", icon: "🪟", label: "Đặt cửa sổ" },
  { key: "iot", icon: "📡", label: "Đặt thiết bị IoT" },
  { key: "label", icon: "🏷️", label: "Thêm nhãn" },
  { key: "dimension", icon: "📐", label: "Thêm kích thước" },
  { key: "erase", icon: "🗑️", label: "Xóa đối tượng" },
];

let _id = 100;
const uid = () => `e${_id++}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function snapAngle(x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const snapped = Math.round(angle / 45) * 45;
  const rad = (snapped * Math.PI) / 180;
  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: snap(x1 + Math.cos(rad) * len),
    y: snap(y1 + Math.sin(rad) * len),
  };
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
function GridLayer({ scale, offsetX, offsetY }) {
  const lines = [];
  const startX = Math.floor(-offsetX / scale / GRID) * GRID;
  const startY = Math.floor(-offsetY / scale / GRID) * GRID;
  const endX = startX + CANVAS_W / scale + GRID * 2;
  const endY = startY + CANVAS_H / scale + GRID * 2;

  for (let x = startX; x <= endX; x += GRID) {
    const isMajor = x % (GRID * 5) === 0;
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, startY, x, endY]}
        stroke={isMajor ? "#CBD5E1" : "#E2E8F0"}
        strokeWidth={isMajor ? 0.7 : 0.4}
        listening={false}
      />,
    );
  }
  for (let y = startY; y <= endY; y += GRID) {
    const isMajor = y % (GRID * 5) === 0;
    lines.push(
      <Line
        key={`h${y}`}
        points={[startX, y, endX, y]}
        stroke={isMajor ? "#CBD5E1" : "#E2E8F0"}
        strokeWidth={isMajor ? 0.7 : 0.4}
        listening={false}
      />,
    );
  }
  return <Layer listening={false}>{lines}</Layer>;
}

// ─── Wall ─────────────────────────────────────────────────────────────────────
function WallShape({ wall, isSelected, onSelect, onMove, mode }) {
  const dx = wall.x2 - wall.x1,
    dy = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const nx = -dy / len,
    ny = dx / len;
  const hw = WALL_THICKNESS / 2;

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
      onClick={() => mode === "select" && onSelect(wall.id)}
      onTap={() => mode === "select" && onSelect(wall.id)}
      shadowEnabled={isSelected}
      shadowColor="rgba(59,130,246,0.4)"
      shadowBlur={8}
    />
  );
}

// ─── Door ─────────────────────────────────────────────────────────────────────
function DoorShape({ door, isSelected, onSelect, onChange, mode }) {
  const size = door.size || 60;
  const flip = door.flip ? -1 : 1;
  return (
    <Group
      x={door.x}
      y={door.y}
      rotation={door.rotation || 0}
      draggable={mode === "select"}
      onClick={() => mode === "select" && onSelect(door.id)}
      onTap={() => mode === "select" && onSelect(door.id)}
      onDragEnd={(e) =>
        onChange(door.id, { x: snap(e.target.x()), y: snap(e.target.y()) })
      }
    >
      {/* Door panel */}
      <Line
        points={[0, 0, size, 0]}
        stroke={isSelected ? "#3B82F6" : "#64748B"}
        strokeWidth={3}
      />
      {/* Arc sweep */}
      <Arc
        x={0}
        y={0}
        innerRadius={0}
        outerRadius={size}
        angle={90}
        rotation={flip < 0 ? -90 : 0}
        scaleY={flip}
        stroke={isSelected ? "#3B82F6" : "#94A3B8"}
        strokeWidth={1.5}
        dash={[5, 3]}
      />
      {/* Wall gap */}
      <Rect
        x={-2}
        y={-5}
        width={size + 4}
        height={WALL_THICKNESS}
        fill="white"
        listening={false}
        opacity={0.9}
      />
      <Line
        points={[0, 0, size, 0]}
        stroke={isSelected ? "#3B82F6" : "#475569"}
        strokeWidth={2.5}
      />
      {isSelected && (
        <Rect
          x={-5}
          y={-size - 5}
          width={size + 10}
          height={size + 10}
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
      onClick={() => mode === "select" && onSelect(win.id)}
      onTap={() => mode === "select" && onSelect(win.id)}
      onDragEnd={(e) =>
        onChange(win.id, { x: snap(e.target.x()), y: snap(e.target.y()) })
      }
    >
      <Rect
        x={0}
        y={-WALL_THICKNESS / 2}
        width={size}
        height={WALL_THICKNESS}
        fill="white"
        stroke={isSelected ? "#3B82F6" : "#64748B"}
        strokeWidth={isSelected ? 2 : 1.5}
      />
      <Line
        points={[size / 3, -WALL_THICKNESS / 2, size / 3, WALL_THICKNESS / 2]}
        stroke={isSelected ? "#3B82F6" : "#94A3B8"}
        strokeWidth={1.5}
      />
      <Line
        points={[
          (size * 2) / 3,
          -WALL_THICKNESS / 2,
          (size * 2) / 3,
          WALL_THICKNESS / 2,
        ]}
        stroke={isSelected ? "#3B82F6" : "#94A3B8"}
        strokeWidth={1.5}
      />
    </Group>
  );
}

// ─── Room ─────────────────────────────────────────────────────────────────────
function RoomShape({ room, isSelected, onSelect, onChange, mode }) {
  const rectRef = useRef();
  const trRef = useRef();

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
        strokeWidth={isSelected ? 2 : 1.5}
        cornerRadius={2}
        opacity={0.85}
        shadowEnabled={isSelected}
        shadowColor="rgba(37,99,235,0.2)"
        shadowBlur={10}
        draggable={mode === "select"}
        onClick={() => mode === "select" && onSelect(room.id)}
        onTap={() => mode === "select" && onSelect(room.id)}
        onDragEnd={(e) =>
          onChange(room.id, { x: snap(e.target.x()), y: snap(e.target.y()) })
        }
        onTransformEnd={() => {
          const n = rectRef.current;
          const sx = n.scaleX(),
            sy = n.scaleY();
          n.scaleX(1);
          n.scaleY(1);
          onChange(room.id, {
            x: snap(n.x()),
            y: snap(n.y()),
            width: snap(Math.max(GRID * 3, n.width() * sx)),
            height: snap(Math.max(GRID * 3, n.height() * sy)),
          });
        }}
      />
      {room.name && (
        <Text
          x={room.x + 6}
          y={room.y + room.height / 2 - 10}
          width={room.width - 12}
          text={room.name}
          fontSize={12}
          fontStyle="bold"
          fontFamily="'Segoe UI', system-ui, sans-serif"
          fill={room.stroke}
          align="center"
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
          boundBoxFunc={(_, nb) => ({
            ...nb,
            width: Math.max(GRID * 3, nb.width),
            height: Math.max(GRID * 3, nb.height),
          })}
        />
      )}
    </>
  );
}

// ─── IoT Marker ───────────────────────────────────────────────────────────────
function IotMarker({ device, isSelected, onSelect, onChange, mode }) {
  const t = IOT_TYPES.find((x) => x.type === device.type) || IOT_TYPES[0];
  return (
    <Group
      x={device.x}
      y={device.y}
      draggable={mode === "select"}
      onClick={() => mode === "select" && onSelect(device.id)}
      onTap={() => mode === "select" && onSelect(device.id)}
      onDragEnd={(e) =>
        onChange(device.id, { x: snap(e.target.x()), y: snap(e.target.y()) })
      }
    >
      <Circle
        radius={15}
        fill={isSelected ? t.color : "white"}
        stroke={t.color}
        strokeWidth={isSelected ? 3 : 2}
        shadowEnabled
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={6}
        shadowOffsetY={2}
      />
      <Text text={t.icon} fontSize={13} x={-7} y={-8} listening={false} />
      {isSelected && (
        <Circle
          radius={20}
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
  return (
    <Group
      x={label.x}
      y={label.y}
      draggable={mode === "select"}
      onClick={() => mode === "select" && onSelect(label.id)}
      onDragEnd={(e) =>
        onChange(label.id, { x: snap(e.target.x()), y: snap(e.target.y()) })
      }
    >
      <Rect
        x={-4}
        y={-4}
        width={label.text.length * 8 + 8}
        height={22}
        fill={isSelected ? "#DBEAFE" : "rgba(255,255,255,0.85)"}
        stroke={isSelected ? "#3B82F6" : "#CBD5E1"}
        strokeWidth={1}
        cornerRadius={3}
      />
      <Text
        text={label.text}
        fontSize={label.fontSize || 13}
        fontStyle="bold"
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fill="#1E293B"
      />
    </Group>
  );
}

// ─── Dimension ────────────────────────────────────────────────────────────────
function DimensionShape({ dim, isSelected, onSelect, onChange, mode }) {
  const dx = dim.x2 - dim.x1,
    dy = dim.y2 - dim.y1;
  const length = Math.round(Math.sqrt(dx * dx + dy * dy));
  const mx = (dim.x1 + dim.x2) / 2,
    my = (dim.y1 + dim.y2) / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const offset = dim.offset || 20;
  const nx = (-dy / length) * offset,
    ny = (dx / length) * offset;

  return (
    <Group onClick={() => mode === "select" && onSelect(dim.id)}>
      {/* Dim line */}
      <Line
        points={[dim.x1 + nx, dim.y1 + ny, dim.x2 + nx, dim.y2 + ny]}
        stroke={isSelected ? "#3B82F6" : "#64748B"}
        strokeWidth={1.5}
        listening={false}
      />
      {/* End ticks */}
      {[
        [dim.x1, dim.y1],
        [dim.x2, dim.y2],
      ].map(([x, y], i) => (
        <Line
          key={i}
          points={[x + nx * 0.5, y + ny * 0.5, x + nx * 1.5, y + ny * 1.5]}
          stroke={isSelected ? "#3B82F6" : "#64748B"}
          strokeWidth={1.5}
          listening={false}
        />
      ))}
      {/* Label */}
      <Group x={mx + nx} y={my + ny} rotation={angle}>
        <Rect
          x={-20}
          y={-10}
          width={40}
          height={14}
          fill="white"
          listening={false}
        />
        <Text
          text={`${length}`}
          fontSize={10}
          fontStyle="bold"
          fill={isSelected ? "#2563EB" : "#475569"}
          x={-18}
          y={-8}
          width={36}
          align="center"
          listening={false}
        />
      </Group>
    </Group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function FloorPlanEditor() {
  const [walls, setWalls] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [doors, setDoors] = useState([]);
  const [windows, setWindows] = useState([]);
  const [iotDevices, setIot] = useState([]);
  const [labels, setLabels] = useState([]);
  const [dimensions, setDims] = useState([]);

  const [tool, setTool] = useState("select");
  const [selectedId, setSelId] = useState(null);
  const [iotType, setIotType] = useState("sensor");
  const [roomColor, setRoomColor] = useState(0);
  const [roomName, setRoomName] = useState("");
  const [doorSize, setDoorSize] = useState(60);
  const [winSize, setWinSize] = useState(80);
  const [labelText, setLabelText] = useState("Nhãn");
  const [scale, setScale] = useState(1);

  // Drawing state
  const [drawStart, setDrawStart] = useState(null);
  const [drawCur, setDrawCur] = useState(null);
  const [dimStart, setDimStart] = useState(null);

  // Rename
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  // Show/hide panels
  const [showIotPanel, setShowIotPanel] = useState(false);

  const stageRef = useRef();

  // ── All objects flat list for selection ────────────────────────────────────
  const allObjects = [
    ...walls,
    ...rooms,
    ...doors,
    ...windows,
    ...iotDevices,
    ...labels,
    ...dimensions,
  ];
  const selObj = allObjects.find((o) => o.id === selectedId);

  // ── Pointer position ───────────────────────────────────────────────────────
  const getPos = useCallback(
    (e) => {
      const stage = e.target.getStage();
      const p = stage.getPointerPosition();
      return { x: snap(p.x / scale), y: snap(p.y / scale) };
    },
    [scale],
  );

  // ── Mouse down ─────────────────────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e) => {
      const p = getPos(e);
      const isStage = e.target === e.target.getStage();

      if (tool === "select" && isStage) {
        setSelId(null);
        return;
      }
      if (tool === "erase") return;

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
            {
              id: uid(),
              type: "dim",
              x1: dimStart.x,
              y1: dimStart.y,
              x2: p.x,
              y2: p.y,
            },
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
            type: "door",
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
          {
            id: uid(),
            type: "window",
            x: p.x,
            y: p.y,
            size: winSize,
            rotation: 0,
          },
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
          {
            id: uid(),
            type: "label",
            x: p.x,
            y: p.y,
            text: labelText,
            fontSize: 13,
          },
        ]);
        return;
      }
    },
    [tool, getPos, dimStart, doorSize, winSize, iotType, labelText],
  );

  const onMouseMove = useCallback(
    (e) => {
      if (!drawStart) return;
      const p = getPos(e);
      if (tool === "wall") {
        const snapped = snapAngle(drawStart.x, drawStart.y, p.x, p.y);
        setDrawCur(snapped);
      } else {
        setDrawCur(p);
      }
    },
    [drawStart, tool, getPos],
  );

  const onMouseUp = useCallback(() => {
    if (!drawStart || !drawCur) return;
    if (tool === "wall") {
      const dx = drawCur.x - drawStart.x,
        dy = drawCur.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > GRID) {
        setWalls((w) => [
          ...w,
          {
            id: uid(),
            type: "wall",
            x1: drawStart.x,
            y1: drawStart.y,
            x2: drawCur.x,
            y2: drawCur.y,
          },
        ]);
      }
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
            type: "room",
            x: drawStart.x < drawCur.x ? drawStart.x : drawCur.x,
            y: drawStart.y < drawCur.y ? drawStart.y : drawCur.y,
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

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updWall = (id, p) =>
    setWalls((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const updRoom = (id, p) =>
    setRooms((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const updDoor = (id, p) =>
    setDoors((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const updWin = (id, p) =>
    setWindows((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const updIot = (id, p) =>
    setIot((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const updLabel = (id, p) =>
    setLabels((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setWalls((a) => a.filter((x) => x.id !== selectedId));
    setRooms((a) => a.filter((x) => x.id !== selectedId));
    setDoors((a) => a.filter((x) => x.id !== selectedId));
    setWindows((a) => a.filter((x) => x.id !== selectedId));
    setIot((a) => a.filter((x) => x.id !== selectedId));
    setLabels((a) => a.filter((x) => x.id !== selectedId));
    setDims((a) => a.filter((x) => x.id !== selectedId));
    setSelId(null);
  }, [selectedId]);

  const eraseClick = useCallback(
    (id) => {
      if (tool !== "erase") return;
      setWalls((a) => a.filter((x) => x.id !== id));
      setRooms((a) => a.filter((x) => x.id !== id));
      setDoors((a) => a.filter((x) => x.id !== id));
      setWindows((a) => a.filter((x) => x.id !== id));
      setIot((a) => a.filter((x) => x.id !== id));
      setLabels((a) => a.filter((x) => x.id !== id));
      setDims((a) => a.filter((x) => x.id !== id));
    },
    [tool],
  );

  const rotateSelected = () => {
    const obj = doors.find((d) => d.id === selectedId);
    if (obj) updDoor(selectedId, { rotation: (obj.rotation + 90) % 360 });
    return;
    const w = windows.find((d) => d.id === selectedId);
    if (w) updWin(selectedId, { rotation: (w.rotation + 90) % 360 });
  };

  const flipDoor = () => {
    const obj = doors.find((d) => d.id === selectedId);
    if (obj) updDoor(selectedId, { flip: !obj.flip });
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (document.activeElement.tagName === "INPUT") return;
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if (e.key === "Escape") {
        setTool("select");
        setDrawStart(null);
        setDimStart(null);
      }
      if (e.key === "r" || e.key === "R") rotateSelected();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [deleteSelected, selectedId]);

  // ── Export PNG ─────────────────────────────────────────────────────────────
  const exportPng = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = "floorplan.png";
    a.click();
  };

  // ── Preview while drawing ──────────────────────────────────────────────────
  const drawPreview = () => {
    if (!drawStart || !drawCur) return null;
    if (tool === "wall") {
      return (
        <Line
          points={[drawStart.x, drawStart.y, drawCur.x, drawCur.y]}
          stroke="#3B82F6"
          strokeWidth={WALL_THICKNESS}
          opacity={0.5}
          listening={false}
          lineCap="round"
        />
      );
    }
    if (tool === "room") {
      const x = Math.min(drawStart.x, drawCur.x),
        y = Math.min(drawStart.y, drawCur.y);
      const w = Math.abs(drawCur.x - drawStart.x),
        h = Math.abs(drawCur.y - drawStart.y);
      return (
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={ROOM_COLORS[roomColor].fill}
          stroke={ROOM_COLORS[roomColor].stroke}
          strokeWidth={1.5}
          dash={[6, 3]}
          opacity={0.6}
          listening={false}
        />
      );
    }
    return null;
  };

  // ── Selected info ──────────────────────────────────────────────────────────
  const selRoom = rooms.find((r) => r.id === selectedId);
  const selDoor = doors.find((r) => r.id === selectedId);
  const selWin = windows.find((r) => r.id === selectedId);
  const selIot = iotDevices.find((r) => r.id === selectedId);
  const selLabel = labels.find((r) => r.id === selectedId);

  const cursorMap = {
    select: "default",
    wall: "crosshair",
    room: "crosshair",
    door: "copy",
    window: "copy",
    iot: "copy",
    label: "text",
    dimension: "crosshair",
    erase: "not-allowed",
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden select-none text-sm">
      {/* ══ TOOLBAR LEFT ════════════════════════════════════════════════════ */}
      <aside className="w-56 bg-slate-900 border-r border-slate-700/60 flex flex-col shrink-0 overflow-y-auto">
        <div className="px-3 pt-3 pb-2 border-b border-slate-700/60">
          <p className="text-white font-bold text-xs tracking-widest uppercase">
            🏠 Floor Plan Editor
          </p>
        </div>

        {/* Tools */}
        <div className="p-2 flex flex-col gap-0.5">
          <p className="text-xs text-slate-500 uppercase tracking-widest px-1 py-1">
            Công cụ
          </p>
          {TOOLS.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => {
                setTool(key);
                setSelId(null);
                setDrawStart(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tool === key
                  ? "bg-blue-600 text-white shadow-md"
                  : key === "erase"
                    ? "bg-slate-800 text-red-400 hover:bg-red-900/40"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tool options */}
        <div className="px-2 pb-2 flex flex-col gap-2">
          {/* Wall options: none needed */}

          {/* Room options */}
          {tool === "room" && (
            <div className="bg-slate-800/60 rounded-xl p-2.5 flex flex-col gap-2">
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                Phòng
              </p>
              <input
                className="w-full bg-slate-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Tên phòng..."
              />
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {ROOM_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setRoomColor(i)}
                    style={{ background: c.fill, borderColor: c.stroke }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      roomColor === i
                        ? "scale-125 ring-2 ring-white"
                        : "hover:scale-110"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Door options */}
          {tool === "door" && (
            <div className="bg-slate-800/60 rounded-xl p-2.5 flex flex-col gap-2">
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                Cửa đi
              </p>
              <label className="text-xs text-slate-400">
                Kích thước: <span className="text-white">{doorSize}px</span>
              </label>
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

          {/* Window options */}
          {tool === "window" && (
            <div className="bg-slate-800/60 rounded-xl p-2.5 flex flex-col gap-2">
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                Cửa sổ
              </p>
              <label className="text-xs text-slate-400">
                Kích thước: <span className="text-white">{winSize}px</span>
              </label>
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

          {/* IoT options */}
          {tool === "iot" && (
            <div className="bg-slate-800/60 rounded-xl p-2.5 flex flex-col gap-1.5">
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                Thiết bị IoT
              </p>
              {IOT_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setIotType(t.type)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                    iotType === t.type
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Label options */}
          {tool === "label" && (
            <div className="bg-slate-800/60 rounded-xl p-2.5 flex flex-col gap-2">
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                Nhãn
              </p>
              <input
                className="w-full bg-slate-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder="Nội dung..."
              />
            </div>
          )}

          {/* Selected properties */}
          {selectedId && tool === "select" && (
            <div className="bg-slate-800/60 rounded-xl p-2.5 flex flex-col gap-2 mt-1">
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                Đã chọn
              </p>

              {selRoom && (
                <>
                  <p className="text-white text-xs font-semibold truncate">
                    {selRoom.name || "(phòng)"}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {selRoom.width} × {selRoom.height} px
                  </p>
                  {renaming === selRoom.id ? (
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        className="flex-1 bg-slate-700 text-white text-xs rounded-lg px-2 py-1 outline-none"
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
                        className="bg-blue-600 text-white text-xs px-2 rounded-lg"
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
                      className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1.5 rounded-lg"
                    >
                      ✏️ Đổi tên
                    </button>
                  )}
                </>
              )}

              {selDoor && (
                <>
                  <p className="text-white text-xs font-semibold">
                    🚪 Cửa đi ({selDoor.size}px)
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={rotateSelected}
                      className="flex-1 text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1.5 rounded-lg"
                    >
                      ↻ Xoay
                    </button>
                    <button
                      onClick={flipDoor}
                      className="flex-1 text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1.5 rounded-lg"
                    >
                      ↔ Lật
                    </button>
                  </div>
                </>
              )}

              {selWin && (
                <>
                  <p className="text-white text-xs font-semibold">
                    🪟 Cửa sổ ({selWin.size}px)
                  </p>
                  <button
                    onClick={rotateSelected}
                    className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1.5 rounded-lg"
                  >
                    ↻ Xoay 90°
                  </button>
                </>
              )}

              {selIot && (
                <>
                  <p className="text-white text-xs font-semibold">
                    {IOT_TYPES.find((t) => t.type === selIot.type)?.icon}{" "}
                    {IOT_TYPES.find((t) => t.type === selIot.type)?.label}
                  </p>
                  <p className="text-slate-400 text-xs">
                    x:{selIot.x} · y:{selIot.y}
                  </p>
                </>
              )}

              {selLabel && (
                <>
                  <p className="text-white text-xs font-semibold">🏷️ Nhãn</p>
                  {renaming === selLabel.id ? (
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        className="flex-1 bg-slate-700 text-white text-xs rounded-lg px-2 py-1 outline-none"
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
                        className="bg-blue-600 text-white text-xs px-2 rounded-lg"
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
                      className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1.5 rounded-lg"
                    >
                      ✏️ Sửa nội dung
                    </button>
                  )}
                </>
              )}

              <button
                onClick={deleteSelected}
                className="text-xs bg-red-700/70 hover:bg-red-600 text-white px-2 py-1.5 rounded-lg"
              >
                🗑️ Xóa
              </button>
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="mt-auto px-3 pb-3 text-xs text-slate-600 space-y-0.5 border-t border-slate-700/40 pt-2">
          <p className="text-slate-500 font-medium">Phím tắt</p>
          <p>Esc → về chọn</p>
          <p>R → xoay</p>
          <p>Del → xóa</p>
        </div>
      </aside>

      {/* ══ MAIN CANVAS ═════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-slate-900 border-b border-slate-700/60 px-3 h-10 flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500">
            {walls.length} tường · {rooms.length} phòng · {doors.length} cửa ·{" "}
            {windows.length} cửa sổ · {iotDevices.length} IoT
          </span>
          <div className="flex-1" />

          {/* Zoom */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                setScale((s) => Math.max(0.4, +(s - 0.1).toFixed(1)))
              }
              className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
            >
              −
            </button>
            <span className="text-xs text-slate-400 w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() =>
                setScale((s) => Math.min(2.5, +(s + 0.1).toFixed(1)))
              }
              className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
            >
              +
            </button>
            <button
              onClick={() => setScale(1)}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 h-6 rounded"
            >
              1:1
            </button>
          </div>

          {/* Export */}
          <button
            onClick={exportPng}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 h-7 rounded-lg font-medium"
          >
            ⬇️ Xuất PNG
          </button>

          {/* Active tool badge */}
          {tool !== "select" && (
            <span className="text-xs bg-blue-600/80 text-white px-3 py-0.5 rounded-full animate-pulse">
              {TOOLS.find((t) => t.key === tool)?.icon}{" "}
              {TOOLS.find((t) => t.key === tool)?.label}
              {dimStart ? " — Click điểm 2" : ""}
            </span>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4">
          <div
            className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-slate-700/50"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <Stage
              ref={stageRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              style={{
                background: "#F8FAFC",
                cursor: cursorMap[tool] || "default",
              }}
            >
              {/* Grid */}
              <GridLayer scale={1} offsetX={0} offsetY={0} />

              {/* Rooms (bottom layer) */}
              <Layer>
                {rooms.map((r) => (
                  <RoomShape
                    key={r.id}
                    room={r}
                    isSelected={selectedId === r.id}
                    onSelect={tool === "erase" ? eraseClick : setSelId}
                    onChange={updRoom}
                    mode={tool}
                  />
                ))}
              </Layer>

              {/* Walls */}
              <Layer>
                {walls.map((w) => (
                  <WallShape
                    key={w.id}
                    wall={w}
                    isSelected={selectedId === w.id}
                    onSelect={tool === "erase" ? eraseClick : setSelId}
                    onMove={updWall}
                    mode={tool}
                  />
                ))}

                {/* Doors */}
                {doors.map((d) => (
                  <DoorShape
                    key={d.id}
                    door={d}
                    isSelected={selectedId === d.id}
                    onSelect={tool === "erase" ? eraseClick : setSelId}
                    onChange={updDoor}
                    mode={tool}
                  />
                ))}

                {/* Windows */}
                {windows.map((w) => (
                  <WindowShape
                    key={w.id}
                    win={w}
                    isSelected={selectedId === w.id}
                    onSelect={tool === "erase" ? eraseClick : setSelId}
                    onChange={updWin}
                    mode={tool}
                  />
                ))}

                {/* Dimensions */}
                {dimensions.map((d) => (
                  <DimensionShape
                    key={d.id}
                    dim={d}
                    isSelected={selectedId === d.id}
                    onSelect={tool === "erase" ? eraseClick : setSelId}
                    onChange={() => {}}
                    mode={tool}
                  />
                ))}

                {/* Draw preview */}
                {drawPreview()}

                {/* Dimension first point indicator */}
                {dimStart && (
                  <Circle
                    x={dimStart.x}
                    y={dimStart.y}
                    radius={5}
                    fill="#3B82F6"
                    listening={false}
                  />
                )}
              </Layer>

              {/* IoT + Labels (top layer) */}
              <Layer>
                {iotDevices.map((d) => (
                  <IotMarker
                    key={d.id}
                    device={d}
                    isSelected={selectedId === d.id}
                    onSelect={tool === "erase" ? eraseClick : setSelId}
                    onChange={updIot}
                    mode={tool}
                  />
                ))}
                {labels.map((l) => (
                  <LabelShape
                    key={l.id}
                    label={l}
                    isSelected={selectedId === l.id}
                    onSelect={tool === "erase" ? eraseClick : setSelId}
                    onChange={updLabel}
                    mode={tool}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
}
