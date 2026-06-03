// Copyright (c) 2026 MeeJoy

export const CONFIGURED_ENV_VALUE = "__CRAZOR_CONFIGURED_ENV_VALUE__"
const EMPTY_RECORD = Object.freeze({})
export const CONNECTOR_BRIDGES = {
  feishu: {
    channelId: "feishu",
    fieldMap: {
      FEISHU_APP_ID: "appId",
      FEISHU_APP_SECRET: "appSecret",
    },
  },
}

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

export function getConnectorBridge(connector) {
  return CONNECTOR_BRIDGES[cleanString(connector?.id).toLowerCase()] || null
}

export function getConnectorBridgeConfig(connector, channelConfigs) {
  const bridge = getConnectorBridge(connector)
  if (!bridge) return EMPTY_RECORD
  const config = channelConfigs?.[bridge.channelId]
  return config && typeof config === "object" ? config : EMPTY_RECORD
}

export function getConnectorBridgeStatus(connector, envMap, channelConfigs) {
  const bridge = getConnectorBridge(connector)
  if (!bridge) return { state: "not_applicable", label: "", description: "" }

  const channelConfig = getConnectorBridgeConfig(connector, channelConfigs)
  const envEntries = Object.entries(bridge.fieldMap)

  const envConfigured = envEntries.every(([envKey]) => hasConnectorCredential(envMap?.[envKey]))
  if (cleanString(connector?.id).toLowerCase() === "feishu") {
    if (envConfigured) {
      return {
        state: "synced",
        label: "Hermes 已写入",
        description: "飞书凭证已写入 Hermes Dashboard .env；运行时状态以真实链路为准。",
      }
    }
    return {
      state: "missing",
      label: "尚未配置",
      description: "后台与 Hermes 还没有完整飞书凭证。",
    }
  }

  const channelConfigured = envEntries.every(([, channelKey]) => hasConnectorCredential(channelConfig?.[channelKey]))
  const synchronized = envConfigured &&
    channelConfigured &&
    envEntries.every(([envKey, channelKey]) => {
      const envValue = cleanString(envMap?.[envKey])
      const channelValue = cleanString(channelConfig?.[channelKey])
      if (!envValue || !channelValue) return false
      if (envValue === CONFIGURED_ENV_VALUE) return true
      return envValue === channelValue
    })

  if (synchronized) {
    return {
      state: "synced",
      label: "Hermes 已同步",
      description: "连接器凭证已同步到 Hermes 通道配置。",
    }
  }

  if (channelConfigured && !envConfigured) {
    return {
      state: "channel_only",
      label: "Hermes 已配置",
      description: "Hermes 已可用，但统一连接器凭证还没有落库。",
    }
  }

  if (envConfigured && !channelConfigured) {
    return {
      state: "env_only",
      label: "待同步到 Hermes",
      description: "连接器凭证已保存，但 Hermes 通道配置还没补齐。",
    }
  }

  if (envConfigured || channelConfigured) {
    return {
      state: "out_of_sync",
      label: "配置不一致",
      description: "连接器与 Hermes 通道配置不一致，建议重新保存一次。",
    }
  }

  return {
    state: "missing",
    label: "尚未配置",
    description: "连接器与 Hermes 通道都还没有凭证。",
  }
}

export function normalizeIntegrationCheck(check) {
  if (!check || typeof check !== "object") {
    return {
      connector_id: "",
      status: "idle",
      summary: "",
      details: {},
      checked_at: "",
      updated_at: "",
    }
  }

  return {
    connector_id: cleanString(check.connector_id),
    status: cleanString(check.status) || "idle",
    summary: cleanString(check.summary),
    details: check.details && typeof check.details === "object" ? check.details : {},
    checked_at: cleanString(check.checked_at),
    updated_at: cleanString(check.updated_at),
  }
}

function readBool(record, key, fallback = false) {
  if (!isRecord(record)) return fallback
  if (typeof record[key] === "boolean") return record[key]
  return fallback
}

function readNumber(record, key) {
  if (!isRecord(record)) return NaN
  const value = Number(record[key])
  return Number.isFinite(value) ? value : NaN
}

function statusFromBoolean(ok, pendingDetail, okDetail, warningDetail) {
  if (ok) return { state: "ok", detail: okDetail }
  if (pendingDetail) return { state: "pending", detail: pendingDetail }
  return { state: "warning", detail: warningDetail }
}

export function getFeishuLinkSteps(envMap, channelConfigs, check) {
  const normalized = normalizeIntegrationCheck(check)
  const details = isRecord(normalized.details) ? normalized.details : EMPTY_RECORD
  const binding = isRecord(details.hermes_binding) ? details.hermes_binding : EMPTY_RECORD
  const bridgeStatus = getConnectorBridgeStatus({ id: "feishu" }, envMap, channelConfigs)
  const hasCheck = Boolean(normalized.checked_at || normalized.summary || normalized.status !== "idle")

  const envConfigured = readBool(
    binding,
    "env_configured",
    hasConnectorCredential(envMap?.FEISHU_APP_ID) && hasConnectorCredential(envMap?.FEISHU_APP_SECRET)
  )
  const hermesConfigured = readBool(
    binding,
    "hermes_configured",
    bridgeStatus.state === "synced" || bridgeStatus.state === "channel_only"
  )
  const synchronized = readBool(binding, "synchronized", bridgeStatus.state === "synced")

  const authCode = readNumber(details, "auth_code")
  const authStatus = readNumber(details, "auth_status")
  const tenantCode = readNumber(details, "tenant_code")
  const authPassed = Number.isFinite(authCode) ? authCode === 0 : normalized.status === "ok" || normalized.status === "warning"
  const authFailed = hasCheck && normalized.status === "error"
  const tenantChecked = Number.isFinite(tenantCode)
  const tenantPassed = tenantChecked && tenantCode === 0
  const runtimeState = cleanString(binding.runtime_state)
  const runtimeConnected = readBool(binding, "runtime_connected", false)
  const runtimeError = cleanString(binding.runtime_error_message)

  const configStep = statusFromBoolean(
    envConfigured,
    "等待填写飞书凭证。",
    "后台已保存飞书 App ID 与 App Secret。",
    "后台还没有完整保存飞书凭证。"
  )

  const hermesStep = statusFromBoolean(
    hermesConfigured,
    envConfigured ? "" : "等待后台凭证保存后写入 Hermes。",
    "飞书凭证已写入 Hermes Dashboard .env。",
    "后台有凭证，但 Hermes 配置还没有完整写入。"
  )

  const syncStep = statusFromBoolean(
    synchronized,
    envConfigured || hermesConfigured ? "" : "等待后台与 Hermes 都完成配置。",
    "后台凭证与 Hermes 配置一致。",
    "后台凭证与 Hermes 配置不一致，建议重新保存。"
  )

  let runtimeStep = {
    state: "pending",
    detail: "等待 Hermes 运行时登记飞书平台。",
  }
  if (runtimeConnected) {
    runtimeStep = {
      state: "ok",
      detail: "Hermes 运行时已连接飞书平台。",
    }
  } else if (runtimeState === "fatal") {
    runtimeStep = {
      state: "error",
      detail: runtimeError || "Hermes 飞书运行时启动失败。",
    }
  } else if (runtimeState === "disconnected") {
    runtimeStep = {
      state: "warning",
      detail: runtimeError || "Hermes 飞书运行时已登记但未连接。",
    }
  } else if (runtimeState === "missing") {
    runtimeStep = {
      state: hermesConfigured ? "warning" : "pending",
      detail: hermesConfigured
        ? "Hermes 已写入飞书配置，但运行时尚未登记飞书平台。"
        : "等待 Hermes 配置完成后启动飞书运行时。",
    }
  } else if (runtimeState) {
    runtimeStep = {
      state: "warning",
      detail: `Hermes 飞书运行时状态为 ${runtimeState}${runtimeError ? `：${runtimeError}` : ""}。`,
    }
  }

  let authState = "pending"
  let authDetail = "尚未执行真实飞书 OpenAPI 认证。"
  if (authPassed) {
    authState = "ok"
    authDetail = `飞书认证已通过${Number.isFinite(authStatus) ? `，HTTP ${authStatus}` : ""}。`
  } else if (authFailed) {
    authState = "error"
    authDetail = normalized.summary || "飞书认证失败。"
  } else if (hasCheck) {
    authState = "warning"
    authDetail = normalized.summary || "飞书认证结果需要确认。"
  }

  let tenantState = "pending"
  let tenantDetail = "认证通过后再检查企业信息权限。"
  if (tenantPassed) {
    tenantState = "ok"
    tenantDetail = "飞书企业信息读取通过。"
  } else if (tenantChecked) {
    tenantState = "warning"
    tenantDetail = cleanString(details.tenant_message) || "飞书认证通过，但企业信息权限还不完整。"
  } else if (authPassed) {
    tenantState = "warning"
    tenantDetail = "飞书认证通过，但还没有拿到企业信息读取结果。"
  }

  return [
    { id: "crazor_config", label: "后台凭证", state: configStep.state, detail: configStep.detail },
    { id: "hermes_config", label: "Hermes 配置", state: hermesStep.state, detail: hermesStep.detail },
    { id: "binding_sync", label: "配置一致性", state: syncStep.state, detail: syncStep.detail },
    { id: "runtime_listener", label: "运行时监听", state: runtimeStep.state, detail: runtimeStep.detail },
    { id: "feishu_auth", label: "飞书认证", state: authState, detail: authDetail },
    { id: "tenant_scope", label: "企业权限", state: tenantState, detail: tenantDetail },
  ]
}
