// M4 3D office: event-bus → office animation routing tables
// Maps M1 event payloads (docs/development/m1-event-bus.md) to the digital
// employee that should perform the on-screen action, plus display labels.

// REST audit entity → digital employee id (see data/employeeMap.js)
export const ENTITY_EMPLOYEE = {
  task: "project-assistant",
  project: "project-assistant",
  project_attachment: "project-assistant",
  contact: "customer-manager",
  contact_doc: "customer-manager",
  contact_attachment: "customer-manager",
  follow_up: "sales-follower",
  transaction: "finance-assistant",
  content_piece: "content-writer",
  channel: "moments-operator",
  channel_referral: "moments-operator",
  delivery: "crossborder-logistics",
  delivery_attachment: "crossborder-logistics",
  doc: "content-writer",
  doc_note: "content-writer",
  doc_folder: "content-writer",
  doc_file: "content-writer",
  team_member: "hr-assistant",
  invite_code: "hr-assistant",
  actor_token: "hr-assistant",
  ai_employee: "hr-assistant",
  skill: "data-dashboard",
  field_definition: "data-dashboard",
}

// MCP tool name → digital employee id (write tools only, same scope as audit)
export const TOOL_EMPLOYEE = {
  create_task: "project-assistant",
  update_task: "project-assistant",
  move_task: "project-assistant",
  create_project: "project-assistant",
  update_project: "project-assistant",
  create_contact: "customer-manager",
  update_contact: "customer-manager",
  crm_update_stage: "customer-manager",
  create_follow_up: "sales-follower",
  update_follow_up: "sales-follower",
  create_transaction: "finance-assistant",
  update_transaction: "finance-assistant",
  create_content_piece: "content-writer",
  update_content_piece: "content-writer",
  delete_content_piece: "content-writer",
  content_update_metrics: "data-dashboard",
  create_channel: "moments-operator",
  update_channel: "moments-operator",
  create_doc: "content-writer",
  update_doc: "content-writer",
  create_folder: "content-writer",
}

export const ENTITY_LABELS = {
  task: "任务",
  project: "项目",
  contact: "客户",
  follow_up: "跟进记录",
  transaction: "收支",
  content_piece: "内容",
  channel: "渠道",
  delivery: "交付",
  doc: "文档",
  doc_note: "笔记",
  doc_folder: "文件夹",
  doc_file: "文件",
  team_member: "成员",
  invite_code: "邀请码",
  skill: "技能",
  ai_employee: "数字员工",
}

const ACTION_LABELS = {
  create: "创建",
  update: "更新",
  delete: "删除",
  move: "移动",
  publish: "发布",
  update_metrics: "更新指标",
}

// tool / entity → hologram icon shown above the working agent
const TOOL_ICONS = [
  [/task|project/, "📋"],
  [/contact|crm|follow/, "📞"],
  [/transaction|finance/, "💰"],
  [/content|doc|folder|note/, "📝"],
  [/channel|moments/, "📣"],
  [/metric|data|dashboard/, "📊"],
  [/delivery|logistics/, "📦"],
]

export function iconFor(key = "") {
  for (const [re, icon] of TOOL_ICONS) {
    if (re.test(key)) return icon
  }
  return "⚙️"
}

// Resolve which digital employee performs the animation for an event
export function routeEmployee(event) {
  if (event?.type === "mcp.tool_called" && event.data?.tool) {
    const hit = TOOL_EMPLOYEE[event.data.tool]
    if (hit) return hit
  }
  return ENTITY_EMPLOYEE[event?.entity] || null
}

// Human-readable one-liner for ticker / event log
export function describeEvent(event) {
  if (!event) return ""
  const who = event.actor_name || (event.actor_type === "agent" ? "数字员工" : "成员")
  switch (event.type) {
    case "presence.online":
      return `🟢 ${who} 上线，走进办公室`
    case "presence.offline":
      return `🌙 ${who} 下线，离开办公室`
    case "member.joined":
      return `🎉 新成员 ${who} 加入团队（${event.data?.department || event.data?.role || "成员"}）`
    case "mcp.tool_called":
      return `${iconFor(event.data?.tool || "")} ${who} 调用工具 ${event.data?.tool || ""}`
    case "entity.created":
    case "entity.updated":
    case "entity.deleted": {
      const entity = ENTITY_LABELS[event.entity] || event.entity || "数据"
      const action =
        ACTION_LABELS[event.data?.action] ||
        { "entity.created": "创建", "entity.updated": "更新", "entity.deleted": "删除" }[event.type]
      return `${iconFor(event.entity || "")} ${who} ${action}了${entity}`
    }
    default:
      return `${who} · ${event.summary || event.type}`
  }
}
