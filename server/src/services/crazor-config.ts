import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync, existsSync } from 'node:fs'

// ── Agent state home ─────────────────────────────────────────
// Crazor may read provider state for analytics and sync Hermes Skills.
// Business data stays in CRAZOR_HOME.
export const AGENT_STATE_HOME = resolve(process.env.AGENT_STATE_HOME || process.env.HERMES_HOME || join(homedir(), '.hermes'))
export const HERMES_HOME = AGENT_STATE_HOME

// ── Crazor data directory ────────────────────────────────────
// Defaults to ~/.crazor/, overridable via CRAZOR_HOME env var.
export const CRAZOR_HOME = resolve(process.env.CRAZOR_HOME || join(homedir(), '.crazor'))

export const CRAZOR_DB_PATH = resolve(CRAZOR_HOME, 'crazor.db')
export const CRAZOR_DOCS_ROOT = resolve(CRAZOR_HOME, 'docs')    // legacy, will be removed
export const CRAZOR_VAULT_ROOT = resolve(CRAZOR_HOME, 'vault')
export const VAULT_META_FILE = '_.json'
export const CRAZOR_SKILLS_DIR = resolve(HERMES_HOME, 'skills/crazor')

// ── Ensure data directory exists ─────────────────────────────
mkdirSync(CRAZOR_HOME, { recursive: true })
mkdirSync(CRAZOR_VAULT_ROOT, { recursive: true })

// ── Authentication config ─────────────────────────────────────
export const WECHAT_APP_ID = process.env.WECHAT_APP_ID || ''
export const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || ''
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
export const CRAZOR_CUSTOMER_ACCESS_CODE = process.env.CRAZOR_CUSTOMER_ACCESS_CODE || ''
export const DEPLOYMENT_TIER = process.env.DEPLOYMENT_TIER || 'free'
export const CRAZOR_DELIVERY_CUSTOMER = process.env.CRAZOR_DELIVERY_CUSTOMER || ''
export const CRAZOR_DELIVERY_CHANNEL = process.env.CRAZOR_DELIVERY_CHANNEL || ''
export const CRAZOR_PUBLIC_BASE_URL = process.env.CRAZOR_PUBLIC_BASE_URL || ''
export const CRAZOR_DELIVERY_PROTOCOL_VERSION = process.env.CRAZOR_DELIVERY_PROTOCOL_VERSION || '1'
export const CRAZOR_RELEASE_ID = process.env.CRAZOR_RELEASE_ID || ''
export const CRAZOR_BUILD_SHA = process.env.CRAZOR_BUILD_SHA || ''
export const CRAZOR_BUILD_TIME = process.env.CRAZOR_BUILD_TIME || ''
export const CRAZOR_DELIVERY_MODEL_READINESS = ['strict', 'warn'].includes(
  String(process.env.CRAZOR_DELIVERY_MODEL_READINESS || '').trim().toLowerCase(),
)
  ? String(process.env.CRAZOR_DELIVERY_MODEL_READINESS).trim().toLowerCase()
  : 'strict'

// ── Migration notice ─────────────────────────────────────────
const legacyDb = resolve(HERMES_HOME, 'crazor.db')
if (!existsSync(CRAZOR_DB_PATH) && existsSync(legacyDb)) {
  console.warn(
    `[crazor] Detected legacy database at ${legacyDb}`,
    `\n[crazor] Crazor data is now stored at ${CRAZOR_HOME}/`,
    `\n[crazor] Run: cp ${legacyDb} ${CRAZOR_DB_PATH}`,
    `\n[crazor] Run: cp -r ${resolve(HERMES_HOME, 'crazor-docs')} ${CRAZOR_DOCS_ROOT}`,
  )
}
