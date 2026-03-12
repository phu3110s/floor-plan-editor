export const GRID = 20;   // visual grid cell size (px)
export const SNAP = 5;    // snap unit for drawing = GRID/4 (smoother movement)
export const WALL_W = 4;
// ORIGIN must be a multiple of GRID so walls can snap flush to the border
export const ORIGIN_X = 80;
export const ORIGIN_Y = 60;

export const SCALE_PRESETS = [
  { label: "1:20",  mmPerPx: 20  },
  { label: "1:50",  mmPerPx: 50  },
  { label: "1:100", mmPerPx: 100 },
  { label: "1:200", mmPerPx: 200 },
];

export const ROOM_COLORS = [
  { fill: "#EFF6FF", stroke: "#3B82F6", name: "Xanh"     },
  { fill: "#F0FDF4", stroke: "#16A34A", name: "Xanh lá"  },
  { fill: "#FEFCE8", stroke: "#CA8A04", name: "Vàng"     },
  { fill: "#FFF1F2", stroke: "#E11D48", name: "Hồng"     },
  { fill: "#F5F3FF", stroke: "#7C3AED", name: "Tím"      },
  { fill: "#FFF7ED", stroke: "#EA580C", name: "Cam"      },
  { fill: "#F0FDFA", stroke: "#0D9488", name: "Ngọc"     },
  { fill: "#FDF4FF", stroke: "#C026D3", name: "Hồng tím" },
];

export const TOOLS = [
  { key: "select",    icon: "↖",  label: "Chọn",       shortcut: "V" },
  { key: "wall",      icon: "╋",  label: "Tường",      shortcut: "W" },
  { key: "room",      icon: "□",  label: "Phòng",      shortcut: "R" },
  { key: "door",      icon: "⌒",  label: "Cửa đi",     shortcut: "D" },
  { key: "window",    icon: "⊟",  label: "Cửa sổ",     shortcut: "S" },
  { key: "label",     icon: "T",  label: "Nhãn",       shortcut: "L" },
  { key: "dimension", icon: "↔",  label: "Kích thước", shortcut: "M" },
  { key: "erase",     icon: "✕",  label: "Xóa",        shortcut: "E" },
];

export const INIT_STATE = {
  walls:       [],
  rooms:       [],
  doors:       [],
  windows:     [],
  labels:      [],
  dims:        [],
  boundaryPts: null,
};
