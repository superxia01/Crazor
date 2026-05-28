// Copyright (c) 2026 MeeJoy

export const CONFIGURED_ENV_VALUE = "__CRAZOR_CONFIGURED_ENV_VALUE__"

function cleanString(value) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
}

export function readConnectorEnvValue(entry) {
  if (entry === null || entry === undefined) return ""
  if (typeof entry !== "object") return cleanString(entry)
  if (!isRecord(entry)) return ""

  for (const key of ["value", "redacted_value", "redactedValue"]) {
    const value = cleanString(entry[key])
    if (value) return value
  }

  return entry.is_set === true || entry.isSet === true ? CONFIGURED_ENV_VALUE : ""
}

export function buildConnectorEnvMap(vars) {
  const map = {}

  if (Array.isArray(vars)) {
    for (const item of vars) {
      if (!isRecord(item)) continue
      const key = cleanString(item.key)
      if (!key) continue
      map[key] = readConnectorEnvValue(Object.prototype.hasOwnProperty.call(item, "value") ? item.value : item)
    }
    return map
  }

  if (isRecord(vars)) {
    for (const [key, value] of Object.entries(vars)) {
      const normalizedKey = cleanString(key)
      if (!normalizedKey) continue
      map[normalizedKey] = readConnectorEnvValue(value)
    }
  }

  return map
}

export function hasConnectorCredential(value) {
  return Boolean(cleanString(value))
}

export function getConnectorStatus(connector, envMap) {
  const fields = Array.isArray(connector?.fields) ? connector.fields : []
  if (fields.length === 0) return "disconnected"
  const filled = fields.filter((field) => hasConnectorCredential(envMap?.[field])).length
  if (filled === 0) return "disconnected"
  if (filled === fields.length) return "connected"
  return "partial"
}

export function parseConnectorFields(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean)
  }

  return cleanString(value)
    .split(",")
    .map(cleanString)
    .filter(Boolean)
}
