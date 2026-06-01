// Copyright (c) 2026 MeeJoy

export async function checkDeliveryReadiness(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl("/api/delivery/readiness", {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

export function deliveryReadinessLabel(status) {
  if (status === "ready") return "交付就绪"
  if (status === "degraded") return "部分可用"
  if (status === "blocked") return "交付阻塞"
  return "未检测"
}

export function deliveryCheckStatusLabel(status) {
  if (status === "ok") return "通过"
  if (status === "warn") return "关注"
  if (status === "error") return "失败"
  return "未知"
}
