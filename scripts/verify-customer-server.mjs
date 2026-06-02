#!/usr/bin/env node

import { fileURLToPath } from "node:url"

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_PROTOCOL_VERSION = "1"

export function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ")
}

export function normalizeServerUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "")
  if (!text) return ""
  try {
    const url = new URL(text)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
  } catch {
    return ""
  }
}

export function normalizeReadinessChecks(checks = []) {
  if (!Array.isArray(checks)) return []
  return checks
    .map((check) => ({
      id: normalizeText(check?.id || ""),
      label: normalizeText(check?.label || check?.id || "检查项"),
      status: normalizeText(check?.status || "unknown"),
      detail: normalizeText(check?.detail || "无详情"),
    }))
    .filter((check) => check.id || check.label || check.detail)
}

export function evaluateCustomerServerReadiness(
  customer,
  serverUrl,
  readiness,
  expectedProtocolVersion = DEFAULT_PROTOCOL_VERSION,
  expectedIdentityFingerprint = "",
) {
  const expectedCustomer = normalizeText(customer)
  const expectedProtocol = normalizeText(expectedProtocolVersion)
  const expectedFingerprint = normalizeText(expectedIdentityFingerprint)
  const normalizedServerUrl = normalizeServerUrl(serverUrl)
  const serverDelivery = readiness?.delivery || {}
  const actualCustomer = normalizeText(serverDelivery.customer || serverDelivery.customerName)
  const publicBaseUrl = normalizeServerUrl(serverDelivery.public_base_url || serverDelivery.publicBaseUrl)
  const actualProtocol = normalizeText(serverDelivery.protocol_version || serverDelivery.protocolVersion)
  const identityFingerprint = normalizeText(serverDelivery.identity_fingerprint || serverDelivery.identityFingerprint)
  const status = normalizeText(readiness?.status)
  const checks = normalizeReadinessChecks(readiness?.checks)
  const errors = []
  const warnings = []

  if (!expectedCustomer) {
    errors.push("缺少客户名称")
  }
  if (!normalizedServerUrl) {
    errors.push("服务器 URL 必须是 http:// 或 https:// 开头的有效地址")
  }
  if (!actualCustomer) {
    errors.push("托管后端未声明 delivery.customer，请配置 CRAZOR_DELIVERY_CUSTOMER")
  } else if (actualCustomer !== expectedCustomer) {
    errors.push(`托管后端声明客户为 ${actualCustomer}，但安装包客户为 ${expectedCustomer}`)
  }
  if (!publicBaseUrl) {
    errors.push("托管后端未声明 delivery.public_base_url，请配置 CRAZOR_PUBLIC_BASE_URL")
  } else if (normalizedServerUrl && publicBaseUrl !== normalizedServerUrl) {
    errors.push(`托管后端公开地址为 ${publicBaseUrl}，但安装包服务器地址为 ${normalizedServerUrl}`)
  }
  if (expectedProtocol && !actualProtocol) {
    errors.push(`托管后端未声明 delivery.protocol_version，安装包需要协议 ${expectedProtocol}`)
  } else if (expectedProtocol && actualProtocol !== expectedProtocol) {
    errors.push(`托管后端协议为 ${actualProtocol}，但安装包需要协议 ${expectedProtocol}`)
  }
  if (expectedFingerprint && !identityFingerprint) {
    errors.push(`托管后端未声明 delivery.identity_fingerprint，安装包需要指纹 ${expectedFingerprint}`)
  } else if (expectedFingerprint && identityFingerprint !== expectedFingerprint) {
    errors.push(`托管后端交付指纹为 ${identityFingerprint}，但安装包需要 ${expectedFingerprint}`)
  }
  if (status === "blocked") {
    errors.push("托管后端交付自检状态为 blocked")
  } else if (status === "degraded") {
    warnings.push("托管后端交付自检状态为 degraded，客户可启动但需要关注警告项")
  } else if (status !== "ready") {
    errors.push(`托管后端交付自检返回未知状态: ${status || "空"}`)
  }

  for (const check of checks) {
    if (check.status === "error") {
      errors.push(`${check.label}失败: ${check.detail}`)
    } else if (check.status === "warn") {
      warnings.push(`${check.label}警告: ${check.detail}`)
    }
  }

  return {
    ok: errors.length === 0,
    customer: expectedCustomer,
    protocolVersion: expectedProtocol,
    identityFingerprint,
    expectedIdentityFingerprint: expectedFingerprint,
    serverUrl: normalizedServerUrl,
    status,
    readinessChecks: checks,
    errors,
    warnings,
  }
}

export async function verifyCustomerServer({
  customer,
  serverUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  protocolVersion = process.env.CRAZOR_DELIVERY_PROTOCOL_VERSION || DEFAULT_PROTOCOL_VERSION,
  identityFingerprint = process.env.CRAZOR_DELIVERY_IDENTITY_FINGERPRINT || "",
} = {}) {
  const normalizedServerUrl = normalizeServerUrl(serverUrl)
  if (!normalizedServerUrl) {
    return evaluateCustomerServerReadiness(customer, serverUrl, null, protocolVersion, identityFingerprint)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${normalizedServerUrl}/api/delivery/readiness`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    if (!response.ok) {
      return {
        ok: false,
        customer: normalizeText(customer),
        protocolVersion: normalizeText(protocolVersion),
        identityFingerprint: "",
        expectedIdentityFingerprint: normalizeText(identityFingerprint),
        serverUrl: normalizedServerUrl,
        status: "",
        readinessChecks: [],
        errors: [`交付自检接口返回 HTTP ${response.status}`],
        warnings: [],
      }
    }
    const readiness = await response.json()
    return evaluateCustomerServerReadiness(customer, normalizedServerUrl, readiness, protocolVersion, identityFingerprint)
  } catch (error) {
    return {
      ok: false,
      customer: normalizeText(customer),
      protocolVersion: normalizeText(protocolVersion),
      identityFingerprint: "",
      expectedIdentityFingerprint: normalizeText(identityFingerprint),
      serverUrl: normalizedServerUrl,
      status: "",
      readinessChecks: [],
      errors: [`无法连接托管后端交付自检: ${error?.message || error}`],
      warnings: [],
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const customer = process.argv[2] || ""
  const serverUrl = process.argv[3] || ""
  const timeoutMs = Number(process.env.CRAZOR_CUSTOMER_SERVER_PREFLIGHT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const protocolVersion = process.env.CRAZOR_DELIVERY_PROTOCOL_VERSION || DEFAULT_PROTOCOL_VERSION
  const identityFingerprint = process.env.CRAZOR_DELIVERY_IDENTITY_FINGERPRINT || ""
  const result = await verifyCustomerServer({ customer, serverUrl, timeoutMs, protocolVersion, identityFingerprint })

  if (result.ok) {
    console.log(`客户服务预检通过: ${result.customer} -> ${result.serverUrl}，协议 ${result.protocolVersion}`)
    for (const warning of result.warnings) {
      console.warn(`警告: ${warning}`)
    }
    return
  }

  console.error("客户服务预检失败:")
  for (const error of result.errors) {
    console.error(`- ${error}`)
  }
  for (const warning of result.warnings) {
    console.warn(`警告: ${warning}`)
  }
  process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`客户服务预检失败: ${error?.message || error}`)
    process.exit(1)
  })
}
