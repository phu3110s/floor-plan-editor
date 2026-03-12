import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Line, Rect, Circle } from "react-konva";

import {
  GRID, SNAP, WALL_W, ORIGIN_X, ORIGIN_Y,
  ROOM_COLORS, TOOLS, INIT_STATE,
} from "./constants";
import { uid, snapV, pxToReal, snapAngle, migrateWall, migrateRoom, polyBounds } from "./utils";
import { SetupDialog }    from "./SetupDialog";
import { GridLayer, HouseFrame, LiveDimLabel } from "./Canvas";
import {
  WallShape, DoorShape, WindowShape, RoomShape,
  LabelShape, DimensionShape, BoundaryShape,
} from "./shapes";

// ═════════════════════════════════════════════════════════════════════════════
export default function FloorPlanEditor() {
  const [config, setConfig] = useState(null);
  const [currentFloor, setCurrentFloor] = useState(1);

  // Per-floor history: { [floorNum]: { past, present, future } }
  const [allFloors, setAllFloors] = useState({
    1: { past: [], present: INIT_STATE, future: [] },
  });

  const floorHist = allFloors[currentFloor] || { past: [], present: INIT_STATE, future: [] };

  const updateFloor = useCallback((fn, floorNum) => {
    const f = floorNum ?? currentFloor;
    setAllFloors((prev) => ({
      ...prev,
      [f]: fn(prev[f] || { past: [], present: INIT_STATE, future: [] }),
    }));
  }, [currentFloor]);

  const pushScene = useCallback((patch) => {
    updateFloor((h) => ({
      past:    [...h.past.slice(-49), h.present],
      present: { ...h.present, ...patch },
      future:  [],
    }));
  }, [updateFloor]);

  const undo = useCallback(() =>
    updateFloor((h) => h.past.length
      ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
      : h,
    ), [updateFloor]);

  const redo = useCallback(() =>
    updateFloor((h) => h.future.length
      ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
      : h,
    ), [updateFloor]);

  const scene    = floorHist.present;
  const canUndo  = floorHist.past.length > 0;
  const canRedo  = floorHist.future.length > 0;
  const { walls, rooms, doors, windows, labels, dims, boundaryPts } = scene;

  // Convenience setters that push to history
  const setWalls   = (fn) => pushScene({ walls:   fn(walls)   });
  const setRooms   = (fn) => pushScene({ rooms:   fn(rooms)   });
  const setDoors   = (fn) => pushScene({ doors:   fn(doors)   });
  const setWindows = (fn) => pushScene({ windows: fn(windows) });
  const setLabels  = (fn) => pushScene({ labels:  fn(labels)  });
  const setDims    = (fn) => pushScene({ dims:    fn(dims)    });
  const setBoundaryPts = (pts) => pushScene({ boundaryPts: pts });

  // ── Tool & draw state ──────────────────────────────────────────────────────
  const [tool,         setTool]         = useState("select");
  const [selectedId,   setSelId]        = useState(null);
  const [wallThickMm,  setWallThickMm]  = useState(200); // mm
  const [roomColor,    setRoomColor]    = useState(0);
  const [roomName,     setRoomName]     = useState("");
  const [doorSize,   setDoorSize]   = useState(800);   // mm
  const [winSize,    setWinSize]    = useState(1200);  // mm
  const [labelText,  setLabelText]  = useState("Nhãn");
  const [viewScale,  setViewScale]  = useState(1);
  const [drawStart,  setDrawStart]  = useState(null);
  const [drawCur,    setDrawCur]    = useState(null);
  const [dimStart,   setDimStart]   = useState(null);
  const [renaming,   setRenaming]   = useState(null);
  const [renameVal,  setRenameVal]  = useState("");
  const [mousePos,   setMousePos]   = useState({ x: 0, y: 0 });
  const [showExport, setShowExport] = useState(false);

  const stageRef = useRef();

  // ── Config-derived values ──────────────────────────────────────────────────
  const widthPx  = config ? Math.round(config.widthMm  / config.mmPerPx) : 0;
  const heightPx = config ? Math.round(config.heightMm / config.mmPerPx) : 0;
  const stageW   = config ? widthPx  + ORIGIN_X + 140 : 800;
  const stageH   = config ? heightPx + ORIGIN_Y + 80  : 600;

  // ── Effective boundary (polygon, falls back to rectangle) ─────────────────
  const effectiveBoundary = boundaryPts ?? (config ? [
    ORIGIN_X,           ORIGIN_Y,
    ORIGIN_X + widthPx, ORIGIN_Y,
    ORIGIN_X + widthPx, ORIGIN_Y + heightPx,
    ORIGIN_X,           ORIGIN_Y + heightPx,
  ] : []);

  // ── Migrate old-format walls/rooms on floor switch ─────────────────────────
  useEffect(() => {
    const needsMigration = walls.some((x) => !x.points) || rooms.some((x) => !x.points);
    if (needsMigration)
      pushScene({ walls: walls.map(migrateWall), rooms: rooms.map(migrateRoom) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFloor]);

  // ── Position helpers ───────────────────────────────────────────────────────
  // Snap a single axis: if within SNAP of boundary → stick to boundary exactly
  const snapAxis = useCallback((v, lo, hi) => {
    const s = snapV(v);
    if (Math.abs(s - lo) <= SNAP) return lo;
    if (Math.abs(s - hi) <= SNAP) return hi;
    return Math.max(lo, Math.min(hi, s));
  }, []);

  // Clamp to building area — uses bounding box of the effective boundary polygon
  const clamp = useCallback((x, y) => {
    const b = effectiveBoundary.length >= 4
      ? polyBounds(effectiveBoundary)
      : { x: ORIGIN_X, y: ORIGIN_Y, width: widthPx, height: heightPx };
    return {
      x: snapAxis(x, b.x, b.x + b.width),
      y: snapAxis(y, b.y, b.y + b.height),
    };
  }, [snapAxis, effectiveBoundary, widthPx, heightPx]);

  // Free position (no building clamp) — used for dimension tool so lines can go outside
  const getPosFree = useCallback((e) => {
    const stage = e.target.getStage?.();
    if (!stage) return null;
    const p = stage.getRelativePointerPosition();
    if (!p) return null;
    return { x: snapV(p.x), y: snapV(p.y) };
  }, []);

  // Building-clamped position
  const getPos = useCallback((e) => {
    const stage = e.target.getStage?.();
    if (!stage) return null;
    const p = stage.getRelativePointerPosition();
    if (!p) return null;
    return clamp(p.x, p.y);
  }, [clamp]);

  const switchToSelect = useCallback(() => {
    setTool("select");
    setDrawStart(null);
    setDimStart(null);
  }, []);

  // ── Floor switching ────────────────────────────────────────────────────────
  const switchFloor = (f) => {
    setAllFloors((prev) => ({
      ...prev,
      [f]: prev[f] || { past: [], present: INIT_STATE, future: [] },
    }));
    setCurrentFloor(f);
    setSelId(null);
    setDrawStart(null);
    setDimStart(null);
  };

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    const isBg = e.target === e.target.getStage();

    // Select tool — only deselect when clicking background
    if (tool === "select") {
      if (isBg) setSelId(null);
      return;
    }

    // Wall tool: allow starting a wall draw even when clicking on an existing wall
    // (name="wall" is set on WallShape's Line). All other shapes block draw.
    const targetName = typeof e.target?.name === "function" ? e.target.name() : "";
    const isWallTarget = targetName === "wall";

    if (!isBg && !isWallTarget && tool !== "erase" && tool !== "dimension") return;

    const p  = tool === "dimension" ? getPosFree(e) : getPos(e);
    if (!p) return;

    if (tool === "wall") { setDrawStart(p); setDrawCur(p); return; }
    if (tool === "room") { setDrawStart(p); setDrawCur(p); return; }

    if (tool === "dimension") {
      if (!dimStart) {
        setDimStart(p);
      } else {
        setDims((d) => [...d, { id: uid(), x1: dimStart.x, y1: dimStart.y, x2: p.x, y2: p.y }]);
        setDimStart(null);
      }
      return;
    }

    if (tool === "door") {
      // doorSize is in mm — convert to px for canvas, min 2 grid cells
      const sizePx = Math.max(GRID * 2, Math.round(doorSize / config.mmPerPx));
      setDoors((d) => [...d, { id: uid(), x: p.x, y: p.y, size: sizePx, rotation: 0, flip: false }]);
      return;
    }
    if (tool === "window") {
      const sizePx = Math.max(GRID * 2, Math.round(winSize / config.mmPerPx));
      setWindows((d) => [...d, { id: uid(), x: p.x, y: p.y, size: sizePx, rotation: 0 }]);
      return;
    }
    if (tool === "label") {
      setLabels((d) => [...d, { id: uid(), x: p.x, y: p.y, text: labelText }]);
      return;
    }
  }, [tool, getPos, getPosFree, dimStart, doorSize, winSize, labelText]);

  const onMouseMove = useCallback((e) => {
    const stage = e.target.getStage?.();
    if (!stage) return;
    const p = stage.getRelativePointerPosition();
    if (!p) return;
    setMousePos({ x: snapV(p.x), y: snapV(p.y) });
    if (!drawStart) return;
    const cp = clamp(p.x, p.y);
    if (tool === "wall") {
      // Hold Shift to snap to 45°/90° increments; free angle by default
      setDrawCur(e.evt?.shiftKey ? snapAngle(drawStart.x, drawStart.y, cp.x, cp.y) : cp);
    } else {
      setDrawCur(cp);
    }
  }, [drawStart, tool, clamp]);

  const onMouseUp = useCallback(() => {
    if (!drawStart || !drawCur) return;
    if (tool === "wall") {
      const dx = drawCur.x - drawStart.x, dy = drawCur.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > GRID)
        setWalls((w) => [...w, { id: uid(), points: [drawStart.x, drawStart.y, drawCur.x, drawCur.y], thick: wallThickMm }]);
    }
    if (tool === "room") {
      const rw = Math.abs(drawCur.x - drawStart.x), rh = Math.abs(drawCur.y - drawStart.y);
      if (rw >= GRID * 2 && rh >= GRID * 2) {
        const c = ROOM_COLORS[roomColor];
        const rx = Math.min(drawStart.x, drawCur.x), ry = Math.min(drawStart.y, drawCur.y);
        setRooms((r) => [...r, {
          id: uid(), name: roomName, fill: c.fill, stroke: c.stroke,
          points: [rx, ry,  rx + rw, ry,  rx + rw, ry + rh,  rx, ry + rh],
        }]);
      }
    }
    setDrawStart(null);
    setDrawCur(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawStart, drawCur, tool, roomColor, roomName, wallThickMm]);

  // ── Object mutations ───────────────────────────────────────────────────────
  const upd = (setter) => (id, patch) => setter((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const updWall   = upd(setWalls);
  const updRoom   = upd(setRooms);
  const updDoor   = upd(setDoors);
  const updWin    = upd(setWindows);
  const updLabel  = upd(setLabels);

  const deleteById = useCallback((id) => {
    [setWalls, setRooms, setDoors, setWindows, setLabels, setDims]
      .forEach((s) => s((a) => a.filter((x) => x.id !== id)));
    if (selectedId === id) setSelId(null);
  }, [selectedId]);

  const deleteSelected = useCallback(() => deleteById(selectedId), [deleteById, selectedId]);

  const handleSelect = useCallback((id) => {
    if (tool === "erase") { deleteById(id); return; }
    setSelId(id);
  }, [tool, deleteById]);

  const rotateSelected = useCallback(() => {
    const d = doors.find((x) => x.id === selectedId);
    if (d) { updDoor(selectedId, { rotation: (d.rotation + 90) % 360 }); return; }
    const w = windows.find((x) => x.id === selectedId);
    if (w) { updWin(selectedId, { rotation: (w.rotation + 90) % 360 }); }
  }, [selectedId, doors, windows]);

  const flipDoor = useCallback(() => {
    const d = doors.find((x) => x.id === selectedId);
    if (d) updDoor(selectedId, { flip: !d.flip });
  }, [selectedId, doors]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault(); redo(); return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { deleteSelected(); return; }
      if (e.key === "Escape") { setTool("select"); setDrawStart(null); setDimStart(null); return; }
      if (e.key === "r" || e.key === "R") { rotateSelected(); return; }
      const map = { v:"select", w:"wall", r:"room", d:"door", s:"window", l:"label", m:"dimension", e:"erase" };
      const t = map[e.key.toLowerCase()];
      if (t) { setTool(t); setSelId(null); setDrawStart(null); setDimStart(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, deleteSelected, rotateSelected]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportPng = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    Object.assign(document.createElement("a"), { href: uri, download: `tang${currentFloor}.png` }).click();
  };

  const buildJson = () => {
    if (!config) return {};
    const buildFloor = (fn) => {
      const s = allFloors[fn]?.present || INIT_STATE;
      const getRoomPts = (r) => r.points ?? [r.x, r.y, r.x + r.width, r.y, r.x + r.width, r.y + r.height, r.x, r.y + r.height];
      return {
        floor: fn,
        function_areas: s.rooms.map((r) => {
          const pts = getRoomPts(r);
          const b = polyBounds(pts);
          return {
            id: r.id, name: r.name || `Room_${r.id}`,
            position_mm: { x: Math.round((b.x - ORIGIN_X) * config.mmPerPx), y: Math.round((b.y - ORIGIN_Y) * config.mmPerPx) },
            size_mm: { width: Math.round(b.width * config.mmPerPx), height: Math.round(b.height * config.mmPerPx) },
            polygon_mm: Array.from({ length: pts.length / 2 }, (_, i) => ({
              x: Math.round((pts[i * 2] - ORIGIN_X) * config.mmPerPx),
              y: Math.round((pts[i * 2 + 1] - ORIGIN_Y) * config.mmPerPx),
            })),
          };
        }),
      };
    };
    return {
      house: { size_mm: { width: config.widthMm, height: config.heightMm }, scale: config.scaleLabel, total_floors: config.floors },
      floors: Array.from({ length: config.floors }, (_, i) => i + 1).map(buildFloor),
    };
  };

  // ── Draw preview ──────────────────────────────────────────────────────────
  const renderPreview = () => {
    if (!drawStart || !drawCur) return null;
    const mmpx = config?.mmPerPx || 100;
    if (tool === "wall")
      return (
        <>
          <Line points={[drawStart.x, drawStart.y, drawCur.x, drawCur.y]}
            stroke="#2563EB" strokeWidth={WALL_W} opacity={0.5} lineCap="round" listening={false} />
          <LiveDimLabel x1={drawStart.x} y1={drawStart.y} x2={drawCur.x} y2={drawCur.y} mmPerPx={mmpx} />
        </>
      );
    if (tool === "room") {
      const rx = Math.min(drawStart.x, drawCur.x), ry = Math.min(drawStart.y, drawCur.y);
      const rw = Math.abs(drawCur.x - drawStart.x), rh = Math.abs(drawCur.y - drawStart.y);
      const c = ROOM_COLORS[roomColor];
      return (
        <>
          <Rect x={rx} y={ry} width={rw} height={rh}
            fill={c.fill} stroke={c.stroke} strokeWidth={1.5} dash={[6, 3]} opacity={0.7} listening={false} />
          <LiveDimLabel x1={drawStart.x} y1={drawStart.y} x2={drawCur.x} y2={drawCur.y} mmPerPx={mmpx} />
        </>
      );
    }
    return null;
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  const selWall     = walls.find((r) => r.id === selectedId);
  const selRoom     = rooms.find((r) => r.id === selectedId);
  const selDoor     = doors.find((r) => r.id === selectedId);
  const selWin      = windows.find((r) => r.id === selectedId);
  const selLabel    = labels.find((r) => r.id === selectedId);
  const selBoundary = selectedId === "__boundary__";
  const hasSel      = !!(selWall || selRoom || selDoor || selWin || selLabel || selBoundary);

  const cursorMap = {
    select: "default", wall: "crosshair", room: "crosshair",
    door: "crosshair", window: "crosshair",
    label: "text", dimension: "crosshair", erase: "not-allowed",
  };

  if (!config)
    return <SetupDialog onStart={(c) => { setConfig(c); setCurrentFloor(1); }} />;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden select-none">
      {/* ── LEFT TOOLBAR ─────────────────────────────────────────────── */}
      <aside className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0 shadow-sm">
        {TOOLS.map(({ key, icon, label, shortcut }) => (
          <button
            key={key}
            title={`${label} (${shortcut})`}
            onClick={() => { setTool(key); setSelId(null); setDrawStart(null); setDimStart(null); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all relative group ${
              tool === key
                ? key === "erase" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700 shadow-sm"
                : key === "erase" ? "text-red-400 hover:bg-red-50"   : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <span className="font-mono text-sm leading-none">{icon}</span>
            <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 hidden group-hover:flex items-center pointer-events-none">
              <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
                {label} <span className="ml-1 bg-gray-700 px-1.5 py-0.5 rounded font-mono text-gray-300 text-xs">{shortcut}</span>
              </div>
            </div>
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={undo} disabled={!canUndo} title="Ctrl+Z"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all text-sm font-bold">↩</button>
        <button onClick={redo} disabled={!canRedo} title="Ctrl+Y"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all text-sm font-bold">↪</button>
      </aside>

      {/* ── CENTER ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-200 px-4 h-11 flex items-center gap-3 shrink-0">
          <button onClick={() => setConfig(null)} className="text-xs text-gray-400 hover:text-gray-700 font-medium">← New</button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">{config.scaleLabel}</span>
          <span className="text-xs text-gray-400">1 ô = {pxToReal(GRID, config.mmPerPx)}</span>
          <div className="flex-1" />
          <span className="text-xs font-mono text-gray-300">
            {pxToReal(mousePos.x - ORIGIN_X, config.mmPerPx)}, {pxToReal(mousePos.y - ORIGIN_Y, config.mmPerPx)}
          </span>
          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button onClick={() => setViewScale((s) => Math.max(0.25, +(s - 0.1).toFixed(1)))}
              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold text-gray-600">−</button>
            <button onClick={() => setViewScale(1)} className="text-xs text-gray-500 w-12 text-center font-mono">
              {Math.round(viewScale * 100)}%
            </button>
            <button onClick={() => setViewScale((s) => Math.min(3, +(s + 0.1).toFixed(1)))}
              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold text-gray-600">+</button>
          </div>
          <button onClick={exportPng} className="bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold px-3 h-8 rounded-lg transition-all">PNG ↓</button>
          <button onClick={() => setShowExport(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 h-8 rounded-lg transition-all">JSON / Export</button>
          {tool !== "select" && (
            <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-medium animate-pulse">
              {TOOLS.find((t) => t.key === tool)?.label}{dimStart ? " — Click điểm 2" : ""}
            </span>
          )}
        </div>

        {/* Floor tabs */}
        {config.floors > 1 && (
          <div className="bg-white border-b border-gray-200 px-4 flex items-center gap-1 h-10 shrink-0">
            <span className="text-xs text-gray-400 font-medium mr-2">Tầng:</span>
            {Array.from({ length: config.floors }, (_, i) => i + 1).map((f) => {
              const hasData = allFloors[f]?.present && Object.values(allFloors[f].present).some((a) => Array.isArray(a) && a.length > 0);
              return (
                <button key={f} onClick={() => switchFloor(f)}
                  className={`relative px-4 h-8 rounded-lg text-sm font-semibold transition-all border ${
                    currentFloor === f ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-50"
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

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <Stage
            ref={stageRef}
            width={Math.round(stageW  * viewScale)}
            height={Math.round(stageH * viewScale)}
            scaleX={viewScale} scaleY={viewScale}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            style={{ cursor: cursorMap[tool] || "default", borderRadius: 12, boxShadow: "0 4px 32px rgba(0,0,0,0.12)" }}
          >
            <HouseFrame
              widthPx={widthPx} heightPx={heightPx}
              mmPerPx={config.mmPerPx} scaleLabel={config.scaleLabel}
            />
            <GridLayer stageW={stageW} stageH={stageH} />

            {/* Boundary outline (editable polygon) */}
            <Layer>
              {effectiveBoundary.length > 0 && (
                <BoundaryShape
                  points={effectiveBoundary}
                  isSelected={selBoundary}
                  onSelect={handleSelect}
                  onChange={setBoundaryPts}
                  listening={tool === "select"}
                />
              )}
            </Layer>

            {/* Rooms */}
            <Layer>
              {rooms.map((r) => (
                <RoomShape key={r.id} room={r} isSelected={selectedId === r.id}
                  onSelect={handleSelect} onChange={updRoom}
                  mmPerPx={config.mmPerPx} onSwitchToSelect={switchToSelect} />
              ))}
            </Layer>

            {/* Walls, doors, windows, dims, preview */}
            <Layer>
              {walls.map((w) => (
                <WallShape key={w.id} wall={w} isSelected={selectedId === w.id}
                  onSelect={handleSelect} onChange={updWall}
                  onSwitchToSelect={switchToSelect} isMovable={tool === "select"}
                  mmPerPx={config.mmPerPx} />
              ))}
              {doors.map((d) => (
                <DoorShape key={d.id} door={d} isSelected={selectedId === d.id}
                  onSelect={handleSelect} onChange={updDoor} onSwitchToSelect={switchToSelect} />
              ))}
              {windows.map((w) => (
                <WindowShape key={w.id} win={w} isSelected={selectedId === w.id}
                  onSelect={handleSelect} onChange={updWin} onSwitchToSelect={switchToSelect} />
              ))}
              {dims.map((d) => (
                <DimensionShape key={d.id} dim={d} isSelected={selectedId === d.id}
                  onSelect={handleSelect} mmPerPx={config.mmPerPx} />
              ))}
              {renderPreview()}
              {/* Dimension first-point indicator */}
              {dimStart && (
                <Circle x={dimStart.x} y={dimStart.y} radius={5}
                  fill="#3B82F6" stroke="white" strokeWidth={1.5} listening={false} />
              )}
            </Layer>

            {/* Labels */}
            <Layer>
              {labels.map((l) => (
                <LabelShape key={l.id} label={l} isSelected={selectedId === l.id}
                  onSelect={handleSelect} onChange={updLabel} onSwitchToSelect={switchToSelect} />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
      <aside className="w-56 bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-sm overflow-y-auto">
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            {TOOLS.find((t) => t.key === tool)?.label}
          </p>

          {tool === "room" && (
            <div className="flex flex-col gap-2">
              <input className="w-full bg-gray-50 text-gray-900 text-sm rounded-xl px-3 py-2 border border-gray-200 outline-none focus:border-blue-400"
                value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Tên phòng..." />
              <div className="flex flex-wrap gap-1.5">
                {ROOM_COLORS.map((c, i) => (
                  <button key={i} onClick={() => setRoomColor(i)}
                    style={{ background: c.fill, borderColor: c.stroke }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${roomColor === i ? "scale-125 ring-2 ring-blue-400" : "hover:scale-110"}`}
                  />
                ))}
              </div>
            </div>
          )}

          {tool === "door" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 font-medium">Rộng cửa (mm)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min={400} max={2400} step={50} value={doorSize}
                  onChange={(e) => setDoorSize(Math.max(400, Math.min(2400, +e.target.value)))}
                  className="w-20 bg-gray-50 text-gray-900 text-sm font-bold rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                />
                <span className="text-xs text-gray-400 font-mono">{(doorSize / 1000).toFixed(2)}m</span>
              </div>
              <input type="range" min={400} max={2400} step={50} value={doorSize}
                onChange={(e) => setDoorSize(+e.target.value)} className="w-full accent-blue-500" />
              <div className="flex justify-between text-[10px] text-gray-300 font-mono">
                <span>400mm</span><span>800mm</span><span>1200mm</span><span>2400mm</span>
              </div>
            </div>
          )}

          {tool === "window" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 font-medium">Rộng cửa sổ (mm)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number" min={400} max={3000} step={100} value={winSize}
                  onChange={(e) => setWinSize(Math.max(400, Math.min(3000, +e.target.value)))}
                  className="w-20 bg-gray-50 text-gray-900 text-sm font-bold rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                />
                <span className="text-xs text-gray-400 font-mono">{(winSize / 1000).toFixed(2)}m</span>
              </div>
              <input type="range" min={400} max={3000} step={100} value={winSize}
                onChange={(e) => setWinSize(+e.target.value)} className="w-full accent-blue-500" />
              <div className="flex justify-between text-[10px] text-gray-300 font-mono">
                <span>400mm</span><span>1200mm</span><span>2400mm</span><span>3m</span>
              </div>
            </div>
          )}

          {tool === "wall" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 font-medium">Độ dày tường (mm)</label>
              <div className="flex gap-2 items-center">
                <input type="number" min={50} max={600} step={10} value={wallThickMm}
                  onChange={(e) => setWallThickMm(Math.max(50, Math.min(600, +e.target.value)))}
                  className="w-20 bg-gray-50 text-gray-900 text-sm font-bold rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                />
                <span className="text-xs text-gray-400 font-mono">{(wallThickMm / 10).toFixed(0)}cm</span>
              </div>
              <input type="range" min={50} max={600} step={10} value={wallThickMm}
                onChange={(e) => setWallThickMm(+e.target.value)} className="w-full accent-blue-500" />
            </div>
          )}

          {tool === "label" && (
            <input className="w-full bg-gray-50 text-gray-900 text-sm rounded-xl px-3 py-2 border border-gray-200 outline-none focus:border-blue-400"
              value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="Nội dung nhãn..." />
          )}

          {tool === "select"    && !hasSel && <p className="text-xs text-gray-400 italic">Click vào đối tượng để chọn</p>}
          {tool === "wall"      && <p className="text-xs text-gray-400">Kéo tự do · Giữ <kbd className="bg-gray-100 px-1 rounded font-mono">Shift</kbd> để snap 45°/90°</p>}
          {tool === "dimension" && <p className="text-xs text-gray-400">{dimStart ? "Click điểm thứ 2" : "Click điểm đầu tiên"}</p>}
          {tool === "erase"     && <p className="text-xs text-red-400">Click vào đối tượng để xóa</p>}
        </div>

        {/* Properties panel */}
        {hasSel && tool === "select" && (
          <div className="p-3 border-b border-gray-100 flex flex-col gap-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Thuộc tính</p>

            {selWall && (() => {
              const curThick = selWall.thick ?? 200;
              return (
                <>
                  <p className="text-sm font-semibold text-gray-800">Tường</p>
                  <label className="text-xs text-gray-500 font-medium">Độ dày (mm)</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" min={50} max={600} step={10} value={curThick}
                      onChange={(e) => updWall(selectedId, { thick: Math.max(50, Math.min(600, +e.target.value)) })}
                      className="w-20 bg-gray-50 text-gray-900 text-sm font-bold rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                    />
                    <span className="text-xs text-gray-400 font-mono">{(curThick / 10).toFixed(0)}cm</span>
                  </div>
                  <input type="range" min={50} max={600} step={10} value={curThick}
                    onChange={(e) => updWall(selectedId, { thick: +e.target.value })}
                    className="w-full accent-blue-500" />
                  <p className="text-xs text-gray-300">{(selWall.points?.length ?? 4) / 2} điểm · Double-click đỉnh để xóa</p>
                </>
              );
            })()}

            {selRoom && (() => {
              const rb = polyBounds(selRoom.points ?? [selRoom.x, selRoom.y, selRoom.x + selRoom.width, selRoom.y, selRoom.x + selRoom.width, selRoom.y + selRoom.height, selRoom.x, selRoom.y + selRoom.height]);
              return (
              <>
                <p className="text-sm font-semibold text-gray-800 truncate">{selRoom.name || "(phòng)"}</p>
                <p className="text-xs font-mono text-gray-400">
                  {pxToReal(rb.width, config.mmPerPx)} × {pxToReal(rb.height, config.mmPerPx)}
                  <span className="ml-1 text-gray-300">({(selRoom.points?.length ?? 8) / 2} đỉnh)</span>
                </p>
                {renaming === selRoom.id ? (
                  <div className="flex gap-1.5">
                    <input autoFocus className="flex-1 bg-gray-50 text-gray-900 text-xs rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                      value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { updRoom(renaming, { name: renameVal }); setRenaming(null); } }}
                    />
                    <button onClick={() => { updRoom(renaming, { name: renameVal }); setRenaming(null); }}
                      className="bg-blue-600 text-white text-xs px-2.5 rounded-lg">✓</button>
                  </div>
                ) : (
                  <button onClick={() => { setRenaming(selRoom.id); setRenameVal(selRoom.name || ""); }}
                    className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 px-3 py-1.5 rounded-xl text-left">✏️ Đổi tên</button>
                )}
              </>
              );
            })()}

            {selBoundary && (
              <>
                <p className="text-sm font-semibold text-gray-800">Khung gốc</p>
                <p className="text-xs text-gray-400">
                  {effectiveBoundary.length / 2} đỉnh · Kéo đỉnh để thay đổi hình dạng
                </p>
                <p className="text-xs text-gray-300">Click giữa cạnh để thêm đỉnh · Double-click đỉnh để xóa</p>
                {boundaryPts && (
                  <button onClick={() => setBoundaryPts(null)}
                    className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 py-1.5 rounded-xl">
                    Reset về hình chữ nhật
                  </button>
                )}
              </>
            )}

            {selDoor && (() => {
              const curMm = Math.round(selDoor.size * config.mmPerPx);
              const setMm = (mm) => updDoor(selectedId, { size: Math.max(GRID * 2, Math.round(mm / config.mmPerPx)) });
              return (
                <>
                  <p className="text-sm font-semibold text-gray-800">🚪 Cửa đi</p>
                  <div className="flex gap-2 items-center">
                    <input type="number" min={400} max={2400} step={50} value={curMm}
                      onChange={(e) => setMm(+e.target.value)}
                      className="w-20 bg-gray-50 text-gray-900 text-sm font-bold rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                    />
                    <span className="text-xs text-gray-400 font-mono">{(curMm / 1000).toFixed(2)}m</span>
                  </div>
                  <input type="range" min={400} max={2400} step={50} value={curMm}
                    onChange={(e) => setMm(+e.target.value)} className="w-full accent-blue-500" />
                  <div className="flex gap-2">
                    <button onClick={rotateSelected} className="flex-1 text-xs border border-gray-200 hover:border-gray-400 text-gray-600 py-1.5 rounded-xl">↻ Xoay</button>
                    <button onClick={flipDoor}       className="flex-1 text-xs border border-gray-200 hover:border-gray-400 text-gray-600 py-1.5 rounded-xl">↔ Lật</button>
                  </div>
                </>
              );
            })()}

            {selWin && (() => {
              const curMm = Math.round(selWin.size * config.mmPerPx);
              const setMm = (mm) => updWin(selectedId, { size: Math.max(GRID * 2, Math.round(mm / config.mmPerPx)) });
              return (
                <>
                  <p className="text-sm font-semibold text-gray-800">🪟 Cửa sổ</p>
                  <div className="flex gap-2 items-center">
                    <input type="number" min={400} max={3000} step={100} value={curMm}
                      onChange={(e) => setMm(+e.target.value)}
                      className="w-20 bg-gray-50 text-gray-900 text-sm font-bold rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                    />
                    <span className="text-xs text-gray-400 font-mono">{(curMm / 1000).toFixed(2)}m</span>
                  </div>
                  <input type="range" min={400} max={3000} step={100} value={curMm}
                    onChange={(e) => setMm(+e.target.value)} className="w-full accent-blue-500" />
                  <button onClick={rotateSelected} className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 py-1.5 rounded-xl">↻ Xoay 90°</button>
                </>
              );
            })()}

            {selLabel && (
              <>
                <p className="text-sm font-semibold text-gray-800">🏷️ Nhãn</p>
                {renaming === selLabel.id ? (
                  <div className="flex gap-1.5">
                    <input autoFocus className="flex-1 bg-gray-50 text-gray-900 text-xs rounded-lg px-2 py-1.5 border border-gray-200 outline-none focus:border-blue-400"
                      value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { updLabel(renaming, { text: renameVal }); setRenaming(null); } }}
                    />
                    <button onClick={() => { updLabel(renaming, { text: renameVal }); setRenaming(null); }}
                      className="bg-blue-600 text-white text-xs px-2.5 rounded-lg">✓</button>
                  </div>
                ) : (
                  <button onClick={() => { setRenaming(selLabel.id); setRenameVal(selLabel.text); }}
                    className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 px-3 py-1.5 rounded-xl">✏️ Sửa nội dung</button>
                )}
              </>
            )}

            {!selBoundary && (
              <button onClick={deleteSelected}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-xl font-medium mt-1">
                Xóa đối tượng
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="p-3 mt-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Thống kê</p>
          {[["Tường", walls.length], ["Phòng", rooms.length], ["Cửa đi", doors.length],
            ["Cửa sổ", windows.length], ["Nhãn", labels.length]].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center py-1">
              <span className="text-xs text-gray-500">{k}</span>
              <span className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{v}</span>
            </div>
          ))}
        </div>

        {/* Shortcuts */}
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Phím tắt</p>
          <div className="text-xs text-gray-400 space-y-1">
            {[["Undo","Ctrl+Z"],["Redo","Ctrl+Y"],["Xoay","R"],["Xóa","Del"],["Hủy","Esc"]].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">{v}</kbd>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── EXPORT MODAL ─────────────────────────────────────────────── */}
      {showExport && (() => {
        const data    = buildJson();
        const jsonStr = JSON.stringify(data, null, 2);
        const totalRooms = data.floors?.reduce((s, f) => s + f.function_areas.length, 0) || 0;
        const totalIot   = data.floors?.reduce((s, f) =>
          s + f.function_areas.reduce((s2, r) => s2 + r.iot_devices.length, 0) + f.unassigned_devices.length, 0) || 0;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-bold text-gray-900 text-base">Xuất dữ liệu Function Areas</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{totalRooms} khu vực · {totalIot} thiết bị IoT · {config.floors} tầng</p>
                </div>
                <button onClick={() => setShowExport(false)}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-lg">×</button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-gray-950">
                <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">{jsonStr}</pre>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                <button onClick={() => navigator.clipboard.writeText(jsonStr)}
                  className="flex-1 border border-gray-200 hover:border-gray-400 text-gray-700 text-sm font-medium py-2.5 rounded-xl">📋 Copy JSON</button>
                <button onClick={() => {
                  const b = new Blob([jsonStr], { type: "application/json" });
                  Object.assign(document.createElement("a"), { href: URL.createObjectURL(b), download: "floorplan.json" }).click();
                }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl">⬇ Download JSON</button>
                <button onClick={exportPng}
                  className="flex-1 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-xl">🖼 Xuất PNG</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
