const FEISHU_AUTH_ENDPOINT = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
const FEISHU_TENANT_ENDPOINT = 'https://open.feishu.cn/open-apis/tenant/v2/tenant/query'

type FeishuConnectorInput = {
  appId: string
  appSecret: string
}

type FeishuConnectorStatus = 'ok' | 'warning' | 'error' | 'missing_credentials'

type FetchLike = typeof fetch

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function readFirstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = cleanString(record[key])
    if (value) return value
  }
  return ''
}

function previewAppId(appId: string) {
  if (!appId) return ''
  if (appId.length <= 10) return appId
  return `${appId.slice(0, 6)}...${appId.slice(-4)}`
}

function nowIso() {
  return new Date().toISOString()
}

function buildResult(
  status: FeishuConnectorStatus,
  summary: string,
  details: Record<string, unknown> = {},
  checkedAt = nowIso(),
) {
  return {
    connector_id: 'feishu',
    status,
    summary,
    details,
    checked_at: checkedAt,
  }
}

export async function testFeishuConnector(
  input: FeishuConnectorInput,
  options: { fetchImpl?: FetchLike } = {},
) {
  const appId = cleanString(input.appId)
  const appSecret = cleanString(input.appSecret)
  const checkedAt = nowIso()
  const fetchImpl = options.fetchImpl || fetch

  if (!appId || !appSecret) {
    return buildResult('missing_credentials', '缺少飞书 App ID 或 App Secret', {
      app_id_preview: previewAppId(appId),
      auth_endpoint: FEISHU_AUTH_ENDPOINT,
      tenant_endpoint: FEISHU_TENANT_ENDPOINT,
    }, checkedAt)
  }

  let authPayload: Record<string, unknown> = {}
  let authStatus = 0

  try {
    const authResponse = await fetchImpl(FEISHU_AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    })
    authStatus = authResponse.status
    authPayload = asRecord(await authResponse.json().catch(() => ({})))
  } catch (error) {
    return buildResult('error', '飞书认证请求失败', {
      app_id_preview: previewAppId(appId),
      auth_endpoint: FEISHU_AUTH_ENDPOINT,
      tenant_endpoint: FEISHU_TENANT_ENDPOINT,
      error_message: error instanceof Error ? error.message : String(error || 'request failed'),
    }, checkedAt)
  }

  const authCode = Number(authPayload.code ?? -1)
  const authMessage = readFirstString(authPayload, ['msg', 'message', 'error_description', 'error']) || '认证失败'
  const tenantAccessToken = readFirstString(authPayload, ['tenant_access_token'])
  const expiresIn = Number(authPayload.expire || 0)

  if (authStatus < 200 || authStatus >= 300 || authCode !== 0 || !tenantAccessToken) {
    return buildResult('error', `飞书认证失败：${authMessage}`, {
      app_id_preview: previewAppId(appId),
      auth_endpoint: FEISHU_AUTH_ENDPOINT,
      tenant_endpoint: FEISHU_TENANT_ENDPOINT,
      auth_status: authStatus,
      auth_code: authCode,
      auth_message: authMessage,
    }, checkedAt)
  }

  let tenantStatus = 0
  let tenantPayload: Record<string, unknown> = {}

  try {
    const tenantResponse = await fetchImpl(FEISHU_TENANT_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
      },
    })
    tenantStatus = tenantResponse.status
    tenantPayload = asRecord(await tenantResponse.json().catch(() => ({})))
  } catch (error) {
    return buildResult('warning', '飞书认证成功，但企业信息读取失败', {
      app_id_preview: previewAppId(appId),
      auth_endpoint: FEISHU_AUTH_ENDPOINT,
      tenant_endpoint: FEISHU_TENANT_ENDPOINT,
      auth_status: authStatus,
      auth_code: authCode,
      auth_message: authMessage,
      expires_in: expiresIn,
      tenant_error: error instanceof Error ? error.message : String(error || 'request failed'),
    }, checkedAt)
  }

  const tenantCode = Number(tenantPayload.code ?? -1)
  const tenantMessage = readFirstString(tenantPayload, ['msg', 'message', 'error']) || '企业信息读取失败'
  const tenantRoot = asRecord(tenantPayload.data)
  const tenant = asRecord(tenantRoot.tenant || tenantRoot)
  const tenantName = readFirstString(tenant, ['name', 'display_name', 'tenant_name'])
  const tenantKey = readFirstString(tenant, ['tenant_key', 'tenantKey', 'key'])

  if (tenantStatus < 200 || tenantStatus >= 300 || tenantCode !== 0) {
    return buildResult('warning', '飞书认证成功，但企业信息读取失败', {
      app_id_preview: previewAppId(appId),
      auth_endpoint: FEISHU_AUTH_ENDPOINT,
      tenant_endpoint: FEISHU_TENANT_ENDPOINT,
      auth_status: authStatus,
      auth_code: authCode,
      auth_message: authMessage,
      expires_in: expiresIn,
      tenant_status: tenantStatus,
      tenant_code: tenantCode,
      tenant_message: tenantMessage,
    }, checkedAt)
  }

  const tenantSummary = tenantName || tenantKey || '当前租户'
  return buildResult('ok', `飞书认证成功，已识别 ${tenantSummary}`, {
    app_id_preview: previewAppId(appId),
    auth_endpoint: FEISHU_AUTH_ENDPOINT,
    tenant_endpoint: FEISHU_TENANT_ENDPOINT,
    auth_status: authStatus,
    auth_code: authCode,
    auth_message: authMessage,
    expires_in: expiresIn,
    tenant_status: tenantStatus,
    tenant_code: tenantCode,
    tenant_message: tenantMessage || 'ok',
    tenant_name: tenantName,
    tenant_key: tenantKey,
  }, checkedAt)
}
