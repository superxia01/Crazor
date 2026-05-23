// Map Crazor digital employees to visual properties with department-based desk positions

export const COLOR_PALETTE = [
  "#4F46E5", // indigo
  "#059669", // emerald
  "#D97706", // amber
  "#DC2626", // rose
  "#7C3AED", // violet
  "#0891B2", // cyan
  "#DB2777", // pink
  "#CA8A04", // yellow
  "#2563EB", // blue
  "#EA580C", // orange
]

// Department groupings and desk assignments
// Grid is 32x24, desks are at specific rows/cols per department
const EMPLOYEE_MAP = {
  // 内容生产部 (top-left, rows 2-4, cols 8-11)
  "素材提炼助手": {
    row: 3, col: 9, colorIdx: 0,
    dept: "内容生产部",
    accessory: "magnifier", // 放大镜
    hatColor: null,
  },
  "内容生产助手": {
    row: 3, col: 10, colorIdx: 1,
    dept: "内容生产部",
    accessory: "pen", // 画笔
    hatColor: null,
  },

  // 运营部 (top-center, rows 2-4, cols 14-17)
  "朋友圈运营助手": {
    row: 3, col: 15, colorIdx: 2,
    dept: "运营部",
    accessory: "phone", // 手机
    hatColor: null,
  },

  // 销售/私域部 (top-right, rows 2-4, cols 20-23)
  "客户管理助手": {
    row: 3, col: 21, colorIdx: 3,
    dept: "销售/私域部",
    accessory: "clipboard", // 名片夹
    hatColor: null,
  },

  // 财务部 (bottom-left, rows 15-17, cols 2-5)
  finance: {
    row: 16, col: 3, colorIdx: 4,
    dept: "财务部",
    accessory: "glasses", // 眼镜
    hatColor: null,
  },

  // 项目/管理部 (bottom, rows 15-17, cols 8-11)
  project: {
    row: 16, col: 9, colorIdx: 5,
    dept: "项目/管理部",
    accessory: "hardhat", // 安全帽
    hatColor: "#F59E0B",
  },

  // 人事部 (bottom, rows 15-17, cols 14-17)
  hr: {
    row: 16, col: 15, colorIdx: 6,
    dept: "人事部",
    accessory: "badge", // 工牌
    hatColor: null,
  },

  // IT/数据部 (bottom, rows 15-17, cols 20-23)
  dashboard: {
    row: 16, col: 21, colorIdx: 8,
    dept: "IT/数据部",
    accessory: "headset", // 耳机
    hatColor: "#2563EB",
  },

  // 库存管理 (bottom-right, rows 15-17, cols 26-29)
  inventory: {
    row: 16, col: 28, colorIdx: 7,
    dept: "库存管理",
    accessory: "box", // 纸箱
    hatColor: null,
  },

  // vault-rules: no desk (system rules, not a person)
  "vault-rules": null,
}

export function getEmployeeVisual(employeeId) {
  const entry = EMPLOYEE_MAP[employeeId]
  if (!entry) return null
  return {
    color: COLOR_PALETTE[entry.colorIdx],
    gridRow: entry.row,
    gridCol: entry.col,
    dept: entry.dept,
    accessory: entry.accessory,
    hatColor: entry.hatColor,
  }
}

export function getDeskPositions() {
  const positions = []
  for (const [id, entry] of Object.entries(EMPLOYEE_MAP)) {
    if (!entry) continue
    positions.push({ id, row: entry.row, col: entry.col, color: COLOR_PALETTE[entry.colorIdx] })
  }
  return positions
}
