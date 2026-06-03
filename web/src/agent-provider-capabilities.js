// Copyright (c) 2026 MeeJoy

export const VIEW_CAPABILITY_RULES = Object.freeze({
  chat: { all: ["gateway.sessions"] },
  sessions: { all: ["gateway.sessions"] },
  cron: { all: ["gateway.jobs"] },
  "hermes-skills": { all: ["dashboard.skills"] },
  tasks: { all: ["dashboard.model_config"] },
  integrations: { all: ["dashboard.env"] },
  files: { all: ["dashboard.files"] },
  memory: { all: ["dashboard.logs"] },
  "hermes-analytics": { all: ["dashboard.status"] },
  "hermes-channels": { all: ["dashboard.channels"] },
  "hermes-memory": { all: ["dashboard.memory"] },
  "hermes-agents": { all: ["dashboard.agents"] },
})

export const HERMES_SUBMENU_ITEM_ORDER = Object.freeze([
  "analytics",
  "model-config",
  "prompt-market",
  "channels",
  "memory",
  "logs",
  "agents",
  "commands",
  "terminal",
])

export const HERMES_SUBMENU_CAPABILITY_RULES = Object.freeze({
  analytics: VIEW_CAPABILITY_RULES["hermes-analytics"],
  "model-config": VIEW_CAPABILITY_RULES.tasks,
  channels: VIEW_CAPABILITY_RULES["hermes-channels"],
  memory: VIEW_CAPABILITY_RULES["hermes-memory"],
  logs: VIEW_CAPABILITY_RULES.memory,
  agents: VIEW_CAPABILITY_RULES["hermes-agents"],
})

export function normalizeCapabilityIds(capabilityIds) {
  if (capabilityIds == null) return null
  const values = Array.isArray(capabilityIds) ? capabilityIds : [capabilityIds]
  return values.map((value) => String(value || "").trim()).filter(Boolean)
}

export function supportsCapabilityRule(capabilityIds, rule) {
  if (!rule) return true
  const normalized = normalizeCapabilityIds(capabilityIds)
  if (normalized == null) return true

  const capabilitySet = new Set(normalized)
  const all = Array.isArray(rule.all) ? rule.all : []
  const any = Array.isArray(rule.any) ? rule.any : []

  if (all.length > 0 && all.some((capabilityId) => !capabilitySet.has(capabilityId))) {
    return false
  }
  if (any.length > 0 && !any.some((capabilityId) => capabilitySet.has(capabilityId))) {
    return false
  }
  return true
}

export function supportsViewCapability(viewId, capabilityIds) {
  return supportsCapabilityRule(capabilityIds, VIEW_CAPABILITY_RULES[viewId])
}

export function supportsHermesSubmenuItem(itemId, capabilityIds) {
  return supportsCapabilityRule(capabilityIds, HERMES_SUBMENU_CAPABILITY_RULES[itemId])
}

export function filterSidebarGroups(groups, capabilityIds) {
  return (Array.isArray(groups) ? groups : [])
    .map((group) => ({
      ...group,
      items: (Array.isArray(group.items) ? group.items : []).filter((item) =>
        supportsViewCapability(item.id, capabilityIds)
      ),
    }))
    .filter((group) => group.items.length > 0)
}

export function getAvailableHermesSubmenuIds(capabilityIds) {
  return HERMES_SUBMENU_ITEM_ORDER.filter((itemId) =>
    supportsHermesSubmenuItem(itemId, capabilityIds)
  )
}

export function getDefaultHermesSubmenuView(capabilityIds) {
  const availableIds = getAvailableHermesSubmenuIds(capabilityIds)
  if (availableIds.includes("model-config")) return "model-config"
  return availableIds[0] || null
}
