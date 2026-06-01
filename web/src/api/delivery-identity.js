// Copyright (c) 2026 MeeJoy

export function evaluateDeliveryIdentity(deliveryInfo = {}, readiness = {}) {
  const clientCustomer = normalizeIdentityText(deliveryInfo.customerName)
  if (!deliveryInfo.enabled || !clientCustomer) {
    return { status: "ok", message: "" }
  }

  const serverDelivery = readiness?.delivery || {}
  const serverCustomer = normalizeIdentityText(serverDelivery.customer || serverDelivery.customerName)
  if (!serverCustomer) {
    return {
      status: "error",
      message: `当前客户端已绑定 ${clientCustomer}，但托管服务未声明交付客户`,
    }
  }

  if (serverCustomer !== clientCustomer) {
    return {
      status: "error",
      message: `当前客户端属于 ${clientCustomer}，但托管服务声明为 ${serverCustomer}`,
    }
  }

  const clientProtocol = normalizeIdentityText(deliveryInfo.protocolVersion)
  const serverProtocol = normalizeIdentityText(serverDelivery.protocol_version || serverDelivery.protocolVersion)
  if (clientProtocol && !serverProtocol) {
    return {
      status: "error",
      message: `当前客户端需要交付协议 ${clientProtocol}，但托管服务未声明协议版本`,
    }
  }
  if (clientProtocol && serverProtocol && clientProtocol !== serverProtocol) {
    return {
      status: "error",
      message: `当前客户端需要交付协议 ${clientProtocol}，但托管服务协议为 ${serverProtocol}`,
    }
  }

  return { status: "ok", message: "" }
}

function normalizeIdentityText(value) {
  return String(value || "").trim().replace(/\s+/g, " ")
}
