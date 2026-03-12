import { Circle, Group } from "react-konva";
import { flatToVerts, edgeMidpoint, vertsToFlat, snapV } from "./utils";

/**
 * Reusable vertex-editing overlay for walls, rooms, and boundary.
 *
 * Props:
 *   points      – flat [x0,y0,x1,y1,...] array (canvas coords)
 *   closed      – true for polygons (rooms/boundary), false for polylines (walls)
 *   minVerts    – minimum number of vertices allowed (2 for walls, 3 for polygons)
 *   onChange    – (newFlatPoints) => void — called on vertex drag end
 *   onMidpointClick – (edgeIndex) => void — called when midpoint is clicked
 *   onVertexDblClick – (vertexIndex) => void — called on double-click to remove vertex
 */
export default function VertexEditor({
  points,
  closed,
  minVerts,
  onChange,
  onMidpointClick,
  onVertexDblClick,
}) {
  const verts = flatToVerts(points);
  const n = verts.length;
  const edgeCount = closed ? n : n - 1;

  const setCursor = (cursor) => (e) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Group>
      {/* Midpoint handles — drawn first so vertex handles appear on top */}
      {Array.from({ length: edgeCount }, (_, i) => {
        const mid = edgeMidpoint(points, i, closed);
        return (
          <Circle
            key={`mid-${i}`}
            x={mid.x}
            y={mid.y}
            radius={5}
            fill="#94A3B8"
            stroke="white"
            strokeWidth={1.5}
            opacity={0.8}
            hitRadius={12}
            onClick={(e) => {
              e.cancelBubble = true;
              onMidpointClick(i);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onMidpointClick(i);
            }}
            onMouseEnter={setCursor("copy")}
            onMouseLeave={setCursor("")}
          />
        );
      })}

      {/* Vertex handles */}
      {verts.map((v, i) => (
        <Circle
          key={`v-${i}`}
          x={v.x}
          y={v.y}
          radius={7}
          fill="#3B82F6"
          stroke="white"
          strokeWidth={2}
          draggable
          onMouseDown={(e) => { e.cancelBubble = true; }}
          onDblClick={(e) => {
            e.cancelBubble = true;
            if (n > minVerts) onVertexDblClick(i);
          }}
          onDblTap={(e) => {
            e.cancelBubble = true;
            if (n > minVerts) onVertexDblClick(i);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            // Snap during drag for visual feedback
            const nx = snapV(e.target.x());
            const ny = snapV(e.target.y());
            e.target.x(nx);
            e.target.y(ny);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const nx = snapV(e.target.x());
            const ny = snapV(e.target.y());
            const newVerts = [...verts];
            newVerts[i] = { x: nx, y: ny };
            onChange(vertsToFlat(newVerts));
          }}
          onMouseEnter={setCursor("move")}
          onMouseLeave={setCursor("")}
        />
      ))}
    </Group>
  );
}
