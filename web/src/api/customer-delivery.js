// Copyright (c) 2026 MeeJoy

import { normalizeRemoteApiBase } from "./remote-api-base.js"

export function getCustomerDeliveryRuntimeInfo(env = import.meta.env || {}) {
  const serverUrl = normalizeRemoteApiBase(env?.VITE_API_BASE)
  const customerName = normalizeDeliveryText(env?.VITE_CRAZOR_CUSTOMER_NAME)
  const channel = normalizeDeliveryText(env?.VITE_CRAZOR_DELIVERY_CHANNEL)
  const protocolVersion = normalizeDeliveryText(env?.VITE_CRAZOR_DELIVERY_PROTOCOL_VERSION)
  const deliveryFingerprint = normalizeDeliveryText(env?.VITE_CRAZOR_DELIVERY_FINGERPRINT)
  const releaseId = normalizeDeliveryText(env?.VITE_CRAZOR_RELEASE_ID)
  const buildSha = normalizeDeliveryText(env?.VITE_CRAZOR_BUILD_SHA)
  const buildTime = normalizeDeliveryText(env?.VITE_CRAZOR_BUILD_TIME)

  return {
    enabled: Boolean(serverUrl || customerName || channel === "customer"),
    customerName,
    channel: channel || (serverUrl ? "customer" : "local"),
    protocolVersion,
    deliveryFingerprint,
    serverUrl,
    releaseId,
    buildSha,
    buildTime,
  }
}

function normalizeDeliveryText(value) {
  return String(value || "").trim()
}
