// Map 21 digital employees to visual properties with department-based desk positions
//
// Office layout (GRID 32×22, 3 rows of rooms):
// Top (rows 1-4):  老板(1-3)|财务(5-7)|人事(9-11)|项目(13-15)|销售(17-21)|新媒体(23-30)
// Mid (rows 6-11): 秘书(1-4)|会议室(6-15)|开放办公(17-23)|跨境电商(25-30)
// Bot (rows 13-16): IT(1-5)|前台(7-13)|海外社媒(15-22)|茶水间(24-30)

export const COLOR_PALETTE = [
  "#4F46E5", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#0891B2", "#DB2777", "#CA8A04",
  "#2563EB", "#EA580C", "#10B981", "#6366F1",
  "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6",
  // Cross-border & overseas
  "#0EA5E9", "#F97316", "#22C55E", "#A855F7",
  "#EC4899", "#64748B", "#84CC16",
]

const EMPLOYEE_MAP = {
  // ── 新媒体运营部 (top-right room, cols 23-30, rows 1-4) ──
  "topic-scheduler": {
    row: 2, col: 23, colorIdx: 0,
    dept: "新媒体运营部",
    accessory: "calendar",
  },
  "content-writer": {
    row: 2, col: 25, colorIdx: 1,
    dept: "新媒体运营部",
    accessory: "pen",
  },
  "material-extractor": {
    row: 2, col: 27, colorIdx: 2,
    dept: "新媒体运营部",
    accessory: "magnifier",
  },
  "ai-news-analyst": {
    row: 2, col: 29, colorIdx: 3,
    dept: "新媒体运营部",
    accessory: "newspaper",
  },
  "wechat-publisher": {
    row: 3, col: 24, colorIdx: 4,
    dept: "新媒体运营部",
    accessory: "phone",
  },
  "xiaohongshu-operator": {
    row: 3, col: 26, colorIdx: 5,
    dept: "新媒体运营部",
    accessory: "camera",
  },

  // ── 销售部 (top, cols 17-21, rows 1-4) ──
  "moments-operator": {
    row: 2, col: 18, colorIdx: 6,
    dept: "销售部",
    accessory: "megaphone",
  },
  "customer-manager": {
    row: 2, col: 20, colorIdx: 7,
    dept: "销售部",
    accessory: "clipboard",
  },
  "sales-follower": {
    row: 3, col: 19, colorIdx: 8,
    dept: "销售部",
    accessory: "handshake",
  },

  // ── 财务部 (top, cols 5-7, rows 1-4) ──
  "finance-assistant": {
    row: 2, col: 6, colorIdx: 9,
    dept: "财务部",
    accessory: "glasses",
  },

  // ── 项目部 (top, cols 13-15, rows 1-4) ──
  "project-assistant": {
    row: 2, col: 14, colorIdx: 10,
    dept: "项目部",
    accessory: "hardhat",
  },

  // ── 人事部 (top, cols 9-11, rows 1-4) ──
  "hr-assistant": {
    row: 2, col: 10, colorIdx: 11,
    dept: "人事部",
    accessory: "badge",
  },

  // ── 开放办公区 (middle, cols 17-23, rows 6-11) ──
  "inventory-assistant": {
    row: 7, col: 19, colorIdx: 13,
    dept: "开放办公区",
    accessory: "box",
  },

  // ── 跨境电商部 (middle-right, cols 25-30, rows 6-11) ──
  "amazon-operator": {
    row: 7, col: 26, colorIdx: 14,
    dept: "跨境电商部",
    accessory: "globe",
  },
  "tiktok-overseas-operator": {
    row: 7, col: 28, colorIdx: 15,
    dept: "跨境电商部",
    accessory: "phone",
  },
  "shopify-operator": {
    row: 8, col: 27, colorIdx: 16,
    dept: "跨境电商部",
    accessory: "store",
  },
  "crossborder-logistics": {
    row: 9, col: 27, colorIdx: 17,
    dept: "跨境电商部",
    accessory: "truck",
  },

  // ── IT部 (bottom-left, cols 1-5, rows 13-16) ──
  "data-dashboard": {
    row: 14, col: 3, colorIdx: 12,
    dept: "IT部",
    accessory: "headset",
  },

  // ── 海外社媒部 (bottom, cols 15-22, rows 13-16) ──
  "youtube-operator": {
    row: 14, col: 16, colorIdx: 18,
    dept: "海外社媒部",
    accessory: "play",
  },
  "instagram-operator": {
    row: 14, col: 18, colorIdx: 19,
    dept: "海外社媒部",
    accessory: "camera",
  },
  "twitter-operator": {
    row: 14, col: 20, colorIdx: 20,
    dept: "海外社媒部",
    accessory: "megaphone",
  },
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
    hatColor: entry.hatColor || null,
  }
}

// Meeting room seats: meeting room occupies rows 7-10, cols 6-15 (interior cols 7-14)
// 21 seats for all employees
export const MEETING_SEATS = [
  // Row 7 (8 seats)
  { row: 7, col: 7 }, { row: 7, col: 8 }, { row: 7, col: 9 },
  { row: 7, col: 12 }, { row: 7, col: 13 }, { row: 7, col: 14 },
  { row: 7, col: 10 }, { row: 7, col: 11 },
  // Row 8 (7 seats)
  { row: 8, col: 7 }, { row: 8, col: 8 }, { row: 8, col: 9 },
  { row: 8, col: 12 }, { row: 8, col: 13 }, { row: 8, col: 14 },
  { row: 8, col: 10 },
  // Row 9 (6 seats)
  { row: 9, col: 7 }, { row: 9, col: 8 }, { row: 9, col: 9 },
  { row: 9, col: 12 }, { row: 9, col: 13 }, { row: 9, col: 14 },
]

export function getDeskPositions() {
  const positions = []
  for (const [id, entry] of Object.entries(EMPLOYEE_MAP)) {
    positions.push({ id, row: entry.row, col: entry.col, color: COLOR_PALETTE[entry.colorIdx] })
  }
  return positions
}
