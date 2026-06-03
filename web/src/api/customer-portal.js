// Copyright (c) 2026 MeeJoy

import { api } from "@/api/client"

export function getCustomerPortal() {
  return api.get("/api/customer/portal")
}

export function getCustomerPortalDoc(id) {
  return api.get(`/api/customer/portal/docs?id=${encodeURIComponent(String(id || ""))}`)
}

export function submitCustomerDeliveryAcceptance(deliveryId, payload = {}) {
  return api.post(`/api/customer/portal/deliveries/${encodeURIComponent(String(deliveryId || ""))}/acceptance`, payload)
}
