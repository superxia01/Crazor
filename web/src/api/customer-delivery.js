// Copyright (c) 2026 MeeJoy

import { normalizeRemoteApiBase } from "./remote-api-base.js"

export function getCustomerDeliveryRuntimeInfo(env = import.meta.env || {}) {
  const serverUrl = normalizeRemoteApiBase(env?.VITE_API_BASE)
  const customerName = normalizeDeliveryText(env?.VITE_CRAZOR_CUSTOMER_NAME)
  const channel = normalizeDeliveryText(env?.VITE_CRAZOR_DELIVERY_CHANNEL)

  return {
    enabled: Boolean(serverUrl || customerName || channel === "customer"),
    customerName,
    channel: channel || (serverUrl ? "customer" : "local"),
    serverUrl,
  }
}

function normalizeDeliveryText(value) {
  return String(value || "").trim()
}
