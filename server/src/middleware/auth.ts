// Crazor JWT Authentication Middleware

import { Context, Next } from 'hono'
import { verifyJWT } from '../services/crazor-auth'
import { getCookie } from 'hono/cookie'
import { DEPLOYMENT_TIER } from '../services/crazor-config'

// /api/events/ws 跳过本中间件：浏览器 WebSocket 无法携带 Authorization 头，
// 升级前由 index.ts 中的路由 guard 用同一套 JWT（cookie / ?token=）完成鉴权。
const PUBLIC_PATHS = ['/api/auth/', '/api/health', '/api/delivery/', '/api/events/ws', '/mcp/sse', '/mcp']

export const authMiddleware = async (c: Context, next: Next) => {
  // Skip auth for public paths
  if (PUBLIC_PATHS.some(p => c.req.path.startsWith(p))) {
    return next()
  }

  // Skip auth if no JWT_SECRET configured (dev mode without auth)
  if (
    !process.env.JWT_SECRET &&
    !process.env.WECHAT_APP_ID &&
    !process.env.CRAZOR_CUSTOMER_ACCESS_CODE &&
    !process.env.CRAZOR_INTERNAL_ACCESS_CODE
  ) {
    return next()
  }

  // Extract token
  const authHeader = c.req.header('Authorization')
  let token: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  if (!token) {
    try {
      token = getCookie(c, 'crazor_token') || null
    } catch { /* no cookie */ }
  }

  if (!token) {
    return c.json({ error: 'Unauthorized', needLogin: true }, 401)
  }

  try {
    const payload = verifyJWT(token)
    c.set('user', payload)
    await next()
  } catch (e: any) {
    const message = e.message?.includes('expired') ? 'Token expired' : 'Invalid token'
    return c.json({ error: message, needLogin: true }, 401)
  }
}

// Require Pro plan for specific routes
export const requirePro = async (c: Context, next: Next) => {
  if (DEPLOYMENT_TIER !== 'pro') {
    return c.json({
      error: '此功能需要升级到专业版',
      upgradeRequired: true,
      currentPlan: DEPLOYMENT_TIER,
    }, 403)
  }
  await next()
}
