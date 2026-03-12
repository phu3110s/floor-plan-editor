import { Line, Rect, Text, Group, Layer } from "react-konva";
import { GRID, ORIGIN_X, ORIGIN_Y } from "./constants";
import { pxToReal } from "./utils";

// ─── Grid ─────────────────────────────────────────────────────────────────────
export function GridLayer({ stageW, stageH }) {
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

// ─── House Frame ──────────────────────────────────────────────────────────────
// Renders rulers, ticks, labels. Boundary outline is now drawn by BoundaryShape in index.jsx.
export function HouseFrame({ widthPx, heightPx, mmPerPx, scaleLabel }) {
  const ox = ORIGIN_X,
    oy = ORIGIN_Y;
  const step = GRID * 2;

  const ticks = [];
  for (let x = 0; x <= widthPx; x += step) {
    ticks.push(
      <Group key={`rx${x}`} listening={false}>
        <Line
          points={[ox + x, oy - 10, ox + x, oy]}
          stroke="#94A3B8"
          strokeWidth={1}
        />
        <Text
          text={pxToReal(x, mmPerPx)}
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
    ticks.push(
      <Group key={`ry${y}`} listening={false}>
        <Line
          points={[ox - 10, oy + y, ox, oy + y]}
          stroke="#94A3B8"
          strokeWidth={1}
        />
        <Text
          text={pxToReal(y, mmPerPx)}
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
      {/* Background */}
      <Rect
        x={0}
        y={0}
        width={ox + widthPx + 140}
        height={oy + heightPx + 80}
        fill="#F1F5F9"
        listening={false}
      />
      {/* White fill inside boundary — outline is now rendered by BoundaryShape */}
      <Rect
        x={ox}
        y={oy}
        width={widthPx}
        height={heightPx}
        fill="white"
        listening={false}
      />

      {/* Ruler lines */}
      <Line
        points={[ox, oy - 38, ox + widthPx, oy - 38]}
        stroke="#94A3B8"
        strokeWidth={1}
        listening={false}
      />
      <Line
        points={[ox - 44, oy, ox - 44, oy + heightPx]}
        stroke="#94A3B8"
        strokeWidth={1}
        listening={false}
      />

      {/* Width label */}
      <Group x={ox + widthPx / 2} y={oy - 52} listening={false}>
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

      {/* Height label */}
      <Group x={ox - 58} y={oy + heightPx / 2} rotation={-90} listening={false}>
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

      {/* Scale badge */}
      <Group x={ox + widthPx + 8} y={oy} listening={false}>
        <Rect
          x={0}
          y={0}
          width={64}
          height={18}
          fill="#E2E8F0"
          cornerRadius={4}
        />
        <Text
          text={`Tỉ lệ ${scaleLabel}`}
          x={2}
          y={4}
          width={60}
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

// ─── Live Dimension Label ─────────────────────────────────────────────────────
export function LiveDimLabel({ x1, y1, x2, y2, mmPerPx }) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return null;
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const text =
    dx !== 0 && dy !== 0
      ? pxToReal(len, mmPerPx)
      : dx !== 0
        ? pxToReal(Math.abs(dx), mmPerPx)
        : pxToReal(Math.abs(dy), mmPerPx);
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
