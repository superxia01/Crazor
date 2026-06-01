export const AGENT_PROVIDER = process.env.AGENT_PROVIDER || process.env.AGENT_GATEWAY_PROVIDER || 'hermes'
export const AGENT_GATEWAY_URL = process.env.AGENT_GATEWAY_URL || process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642'
export const AGENT_DASHBOARD_URL = process.env.AGENT_DASHBOARD_URL || process.env.HERMES_DASHBOARD_URL || 'http://127.0.0.1:9119'
export const AGENT_GATEWAY_API_KEY =
  process.env.AGENT_GATEWAY_API_KEY || process.env.HERMES_API_SERVER_KEY || process.env.API_SERVER_KEY || ''

export type AgentProviderCapabilityId =
  | 'gateway.status'
  | 'gateway.chat_completions'
  | 'gateway.responses'
  | 'gateway.models'
  | 'gateway.sessions'
  | 'gateway.jobs'
  | 'dashboard.status'
  | 'dashboard.config'
  | 'dashboard.env'
  | 'dashboard.model_config'
  | 'dashboard.skills'
  | 'dashboard.skills_market'
  | 'dashboard.toolsets'
  | 'dashboard.memory'
  | 'dashboard.tasks'
  | 'dashboard.agents'
  | 'dashboard.channels'
  | 'dashboard.files'
  | 'dashboard.logs'
  | 'dashboard.update'
  | 'crazor.mcp'

export type AgentProviderCapability = {
  id: AgentProviderCapabilityId
  label: string
  layer: 'gateway' | 'dashboard' | 'crazor'
  api_paths: string[]
}

export const AGENT_PROVIDER_KIND =
  process.env.AGENT_PROVIDER_KIND ||
  process.env.AGENT_GATEWAY_KIND ||
  (isHermesCompatibleProvider() ? 'hermes-compatible' : 'openai-compatible')

export const AGENT_PROVIDER_DISPLAY_NAME =
  process.env.AGENT_PROVIDER_DISPLAY_NAME ||
  process.env.AGENT_PROVIDER_NAME ||
  providerDisplayName(AGENT_PROVIDER)

const CAPABILITY_CATALOG: Record<AgentProviderCapabilityId, AgentProviderCapability> = {
  'gateway.status': {
    id: 'gateway.status',
    label: 'Agent Gateway 状态',
    layer: 'gateway',
    api_paths: ['/api/agent/provider', '/api/models'],
  },
  'gateway.chat_completions': {
    id: 'gateway.chat_completions',
    label: 'Chat Completions 对话',
    layer: 'gateway',
    api_paths: ['/api/chat/completions'],
  },
  'gateway.responses': {
    id: 'gateway.responses',
    label: 'Responses 对话',
    layer: 'gateway',
    api_paths: ['/api/responses'],
  },
  'gateway.models': {
    id: 'gateway.models',
    label: '模型列表',
    layer: 'gateway',
    api_paths: ['/api/models'],
  },
  'gateway.sessions': {
    id: 'gateway.sessions',
    label: '会话管理',
    layer: 'gateway',
    api_paths: ['/api/sessions'],
  },
  'gateway.jobs': {
    id: 'gateway.jobs',
    label: '定时任务',
    layer: 'gateway',
    api_paths: ['/api/cron'],
  },
  'dashboard.status': {
    id: 'dashboard.status',
    label: 'Provider 控制台状态',
    layer: 'dashboard',
    api_paths: ['/api/status', '/api/hermes/version'],
  },
  'dashboard.config': {
    id: 'dashboard.config',
    label: 'Provider 配置',
    layer: 'dashboard',
    api_paths: ['/api/config', '/api/config/raw'],
  },
  'dashboard.env': {
    id: 'dashboard.env',
    label: 'Provider 环境变量',
    layer: 'dashboard',
    api_paths: ['/api/env'],
  },
  'dashboard.model_config': {
    id: 'dashboard.model_config',
    label: '模型配置',
    layer: 'dashboard',
    api_paths: ['/api/model/info', '/api/model/options', '/api/model/set'],
  },
  'dashboard.skills': {
    id: 'dashboard.skills',
    label: '技能管理',
    layer: 'dashboard',
    api_paths: ['/api/skills'],
  },
  'dashboard.skills_market': {
    id: 'dashboard.skills_market',
    label: '技能市场',
    layer: 'dashboard',
    api_paths: ['/api/skills/market'],
  },
  'dashboard.toolsets': {
    id: 'dashboard.toolsets',
    label: '工具集状态',
    layer: 'dashboard',
    api_paths: ['/api/tools/toolsets'],
  },
  'dashboard.memory': {
    id: 'dashboard.memory',
    label: 'Provider 记忆',
    layer: 'dashboard',
    api_paths: ['/api/memories', '/api/hermes-config/memory'],
  },
  'dashboard.tasks': {
    id: 'dashboard.tasks',
    label: 'Provider 任务',
    layer: 'dashboard',
    api_paths: ['/api/tasks'],
  },
  'dashboard.agents': {
    id: 'dashboard.agents',
    label: 'Provider Agent 列表',
    layer: 'dashboard',
    api_paths: ['/api/agents'],
  },
  'dashboard.channels': {
    id: 'dashboard.channels',
    label: 'Provider 渠道',
    layer: 'dashboard',
    api_paths: ['/api/channels'],
  },
  'dashboard.files': {
    id: 'dashboard.files',
    label: 'Provider 文件能力',
    layer: 'dashboard',
    api_paths: ['/api/files/list', '/api/files/read', '/api/files/write'],
  },
  'dashboard.logs': {
    id: 'dashboard.logs',
    label: 'Provider 日志',
    layer: 'dashboard',
    api_paths: ['/api/logs'],
  },
  'dashboard.update': {
    id: 'dashboard.update',
    label: 'Provider 更新',
    layer: 'dashboard',
    api_paths: ['/api/hermes/update'],
  },
  'crazor.mcp': {
    id: 'crazor.mcp',
    label: 'Crazor MCP 工具',
    layer: 'crazor',
    api_paths: ['/mcp', '/mcp/sse'],
  },
}

const HERMES_CAPABILITIES: AgentProviderCapabilityId[] = [
  'gateway.status',
  'gateway.chat_completions',
  'gateway.responses',
  'gateway.models',
  'gateway.sessions',
  'gateway.jobs',
  'dashboard.status',
  'dashboard.config',
  'dashboard.env',
  'dashboard.model_config',
  'dashboard.skills',
  'dashboard.skills_market',
  'dashboard.toolsets',
  'dashboard.memory',
  'dashboard.tasks',
  'dashboard.agents',
  'dashboard.channels',
  'dashboard.files',
  'dashboard.logs',
  'dashboard.update',
  'crazor.mcp',
]

const OPENAI_COMPATIBLE_CAPABILITIES: AgentProviderCapabilityId[] = [
  'gateway.status',
  'gateway.chat_completions',
  'gateway.responses',
  'gateway.models',
  'crazor.mcp',
]

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
  const provider = AGENT_PROVIDER.toLowerCase()
  return provider === 'hermes' || provider === 'hermes-compatible' || provider.startsWith('hermes:')
}

export function getAgentProviderDescriptor() {
  const capabilities = getAgentProviderCapabilities()
  return {
    id: AGENT_PROVIDER,
    kind: AGENT_PROVIDER_KIND,
    display_name: AGENT_PROVIDER_DISPLAY_NAME,
    default_provider: AGENT_PROVIDER === 'hermes',
    hermes_compatible: isHermesCompatibleProvider(),
    endpoints: {
      gateway_url: maskUrlSecret(AGENT_GATEWAY_URL),
      dashboard_url: agentProviderSupports('dashboard.status') ? maskUrlSecret(AGENT_DASHBOARD_URL) : '',
      api_key_configured: isUsableSecret(AGENT_GATEWAY_API_KEY),
    },
    capabilities,
    capability_ids: capabilities.map((capability) => capability.id),
  }
}

export function getAgentProviderCapabilities(): AgentProviderCapability[] {
  return resolveAgentProviderCapabilityIds().map((id) => CAPABILITY_CATALOG[id]).filter(Boolean)
}

export function agentProviderSupports(capabilityId: AgentProviderCapabilityId): boolean {
  return resolveAgentProviderCapabilityIds().includes(capabilityId)
}

export function unsupportedAgentProviderCapability(capabilityId: AgentProviderCapabilityId) {
  const capability = CAPABILITY_CATALOG[capabilityId]
  return {
    error: 'agent_provider_capability_not_supported',
    provider: AGENT_PROVIDER,
    capability: capabilityId,
    message: `${AGENT_PROVIDER_DISPLAY_NAME} 未声明支持 ${capability?.label || capabilityId}`,
  }
}

export function maskUrlSecret(value: string): string {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    if (url.username) url.username = '***'
    if (url.password) url.password = '***'
    return url.toString().replace(/\/$/, '')
  } catch {
    return text.replace(/([?&](?:api[_-]?key|token|secret)=)[^&]+/gi, '$1***')
  }
}

function resolveAgentProviderCapabilityIds(): AgentProviderCapabilityId[] {
  const explicit = parseCapabilityList(process.env.AGENT_PROVIDER_CAPABILITIES || process.env.AGENT_CAPABILITIES)
  const defaults = explicit.length > 0
    ? explicit
    : isHermesCompatibleProvider()
      ? HERMES_CAPABILITIES
      : OPENAI_COMPATIBLE_CAPABILITIES

  const disabled = new Set(parseCapabilityList(process.env.AGENT_PROVIDER_DISABLED_CAPABILITIES || process.env.AGENT_DISABLED_CAPABILITIES))
  return Array.from(new Set(defaults)).filter((id) => !disabled.has(id))
}

function parseCapabilityList(value: unknown): AgentProviderCapabilityId[] {
  return String(value || '')
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter((item): item is AgentProviderCapabilityId => Boolean(item && CAPABILITY_CATALOG[item as AgentProviderCapabilityId]))
}

function providerDisplayName(provider: string): string {
  const normalized = String(provider || '').trim()
  if (!normalized) return 'Agent Provider'
  if (normalized === 'hermes' || normalized === 'hermes-compatible') return 'Hermes Agent'
  return normalized
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}
