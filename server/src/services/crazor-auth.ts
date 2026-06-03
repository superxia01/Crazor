// Crazor Authentication — WeChat OAuth2 + JWT

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { WECHAT_APP_ID, WECHAT_APP_SECRET, JWT_SECRET, CRAZOR_CUSTOMER_ACCESS_CODE, CRAZOR_INTERNAL_ACCESS_CODE } from './crazor-config'
import { db } from './crazor-db'

// ── JWT (simple implementation, no external deps) ────────────

function base64url(value: string | Buffer): string {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): string {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf8')
}

interface JWTPayload {
  openid: string
  nickname: string
  portal_mode?: boolean
  login_channel?: string
  customer_name?: string
  iat: number
  exp: number
}

export function signJWT(payload: {
  openid: string
  nickname: string
  portal_mode?: boolean
  login_channel?: string
  customer_name?: string
}, expiresInDays = 7): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = base64url(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expiresInDays * 86400,
  }))
  const signature = base64url(
    sign(`${header}.${body}`)
  )
  return `${header}.${body}.${signature}`
}

export function verifyJWT(token: string): JWTPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')

  const [header, body, signature] = parts
  const expectedSig = base64url(sign(`${header}.${body}`))
  if (signature !== expectedSig) throw new Error('Invalid JWT signature')

  const payload: JWTPayload = JSON.parse(base64urlDecode(body))
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired')
  return payload
}

function sign(data: string): Buffer {
  return createHmac('sha256', JWT_SECRET).update(data).digest()
}

export function customerAccessCodeConfigured(): boolean {
  return CRAZOR_CUSTOMER_ACCESS_CODE.trim().length > 0
}

export function verifyCustomerAccessCode(code: string): boolean {
  const expected = CRAZOR_CUSTOMER_ACCESS_CODE.trim()
  const actual = String(code || '').trim()
  if (!expected || !actual) return false
  const expectedHash = createHash('sha256').update(expected).digest()
  const actualHash = createHash('sha256').update(actual).digest()
  return timingSafeEqual(expectedHash, actualHash)
}

export function internalAccessCodeConfigured(): boolean {
  return CRAZOR_INTERNAL_ACCESS_CODE.trim().length > 0
}

export function verifyInternalAccessCode(code: string): boolean {
  const expected = CRAZOR_INTERNAL_ACCESS_CODE.trim()
  const actual = String(code || '').trim()
  if (!expected || !actual) return false
  const expectedHash = createHash('sha256').update(expected).digest()
  const actualHash = createHash('sha256').update(actual).digest()
  return timingSafeEqual(expectedHash, actualHash)
}

// ── WeChat OAuth2 ────────────────────────────────────────────

export function generateState(): string {
  return randomUUID().replace(/-/g, '')
}

export function getWechatLoginUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    appid: WECHAT_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  })
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`
}

export async function exchangeCodeForToken(code: string): Promise<{
  openid: string
  unionid?: string
  nickname: string
  avatar_url: string
}> {
  // Step 1: Exchange code for access_token
  const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
  tokenUrl.searchParams.set('appid', WECHAT_APP_ID)
  tokenUrl.searchParams.set('secret', WECHAT_APP_SECRET)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('grant_type', 'authorization_code')

  const tokenResp = await fetch(tokenUrl.toString())
  const tokenData = await tokenResp.json() as any

  if (tokenData.errcode) {
    throw new Error(`WeChat token error: ${tokenData.errmsg} (${tokenData.errcode})`)
  }

  // Step 2: Get user info
  const userUrl = new URL('https://api.weixin.qq.com/sns/userinfo')
  userUrl.searchParams.set('access_token', tokenData.access_token)
  userUrl.searchParams.set('openid', tokenData.openid)

  const userResp = await fetch(userUrl.toString())
  const userData = await userResp.json() as any

  if (userData.errcode) {
    throw new Error(`WeChat userinfo error: ${userData.errmsg} (${userData.errcode})`)
  }

  return {
    openid: userData.openid,
    unionid: userData.unionid,
    nickname: userData.nickname || userData.openid,
    avatar_url: userData.headimgurl || '',
  }
}

// ── User management (SQLite) ─────────────────────────────────

export function upsertUser(wechatInfo: { openid: string; unionid?: string; nickname: string; avatar_url: string }) {
  const now = new Date().toISOString()
  const id = `user_${wechatInfo.openid.slice(0, 16)}`

  // Check if user exists
  const existing = db.query('SELECT * FROM users WHERE wechat_openid = ?')
    .get(wechatInfo.openid) as any

  if (existing) {
    // Update last login
    db.query('UPDATE users SET last_login_at = ?, nickname = ?, avatar_url = ? WHERE id = ?')
      .run(now, wechatInfo.nickname, wechatInfo.avatar_url, existing.id)
    return existing
  }

  // Create new user
  db.query('INSERT INTO users (id, wechat_openid, wechat_unionid, nickname, avatar_url, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, wechatInfo.openid, wechatInfo.unionid || null, wechatInfo.nickname, wechatInfo.avatar_url, now, now)

  return db.query('SELECT * FROM users WHERE id = ?').get(id) as any
}

export function getUserByOpenid(openid: string) {
  return db.query('SELECT * FROM users WHERE wechat_openid = ?').get(openid) as any
}

export function isUserBound(): boolean {
  const user = db.query('SELECT id FROM users LIMIT 1').get() as any
  return !!user
}
