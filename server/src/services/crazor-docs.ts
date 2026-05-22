// Copyright (c) 2026 MeeJoy
// Markdown document management for Crazor

import { resolve, join } from "path"
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import { CRAZOR_DOCS_ROOT as DOCS_ROOT } from "./crazor-config"

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

function contactDir(contactId: string) {
  const dir = resolve(DOCS_ROOT, "contacts", contactId)
  ensureDir(dir)
  return dir
}

// ── Contact docs ────────────────────────────────────────────

export function listContactDocs(contactId: string) {
  const dir = contactDir(contactId)
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const stat = { name: f, path: `${contactId}/${f}` }
        return stat
      })
  } catch {
    return []
  }
}

export function createContactDoc(contactId: string, filename: string, content: string = "") {
  const dir = contactDir(contactId)
  const safeName = filename.endsWith(".md") ? filename : `${filename}.md`
  const filePath = resolve(dir, safeName)
  writeFileSync(filePath, content, "utf-8")
  return { name: safeName, path: `${contactId}/${safeName}` }
}

export function readDoc(docPath: string) {
  const filePath = resolve(DOCS_ROOT, docPath)
  if (!filePath.startsWith(DOCS_ROOT)) return null // security: no path traversal
  if (!existsSync(filePath)) return null
  return readFileSync(filePath, "utf-8")
}

export function updateDoc(docPath: string, content: string) {
  const filePath = resolve(DOCS_ROOT, docPath)
  if (!filePath.startsWith(DOCS_ROOT)) return false
  ensureDir(resolve(filePath, ".."))
  writeFileSync(filePath, content, "utf-8")
  return true
}

export function deleteDoc(docPath: string) {
  const filePath = resolve(DOCS_ROOT, docPath)
  if (!filePath.startsWith(DOCS_ROOT)) return false
  if (existsSync(filePath)) {
    const { unlinkSync } = require("fs")
    unlinkSync(filePath)
  }
  return true
}
