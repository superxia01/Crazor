export const AGENT_PROVIDER = process.env.AGENT_PROVIDER || process.env.AGENT_GATEWAY_PROVIDER || 'hermes'
export const AGENT_GATEWAY_URL = process.env.AGENT_GATEWAY_URL || process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642'
export const AGENT_DASHBOARD_URL = process.env.AGENT_DASHBOARD_URL || process.env.HERMES_DASHBOARD_URL || 'http://127.0.0.1:9119'
export const AGENT_GATEWAY_API_KEY =
  process.env.AGENT_GATEWAY_API_KEY || process.env.HERMES_API_SERVER_KEY || process.env.API_SERVER_KEY || ''

export function isUsableSecret(value: string): boolean {
  const trimmed = String(value || '').trim()
  return Boolean(trimmed) && !trimmed.startsWith('change-me') && !trimmed.includes('请替换')
}

export function agentGatewayHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const next: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }
  if (isUsableSecret(AGENT_GATEWAY_API_KEY)) {
    next.Authorization = `Bearer ${AGENT_GATEWAY_API_KEY}`
    next['X-API-Key'] = AGENT_GATEWAY_API_KEY
  }
  return next
}

export function isHermesCompatibleProvider(): boolean {
  return AGENT_PROVIDER === 'hermes' || AGENT_PROVIDER === 'hermes-compatible'
}
