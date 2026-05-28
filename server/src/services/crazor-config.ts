import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync, existsSync } from 'node:fs'

// ── Hermes home (read-only) ──────────────────────────────────
// Crazor reads state.db for session analytics but never writes to Hermes.
export const HERMES_HOME = resolve(homedir(), '.hermes')

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
