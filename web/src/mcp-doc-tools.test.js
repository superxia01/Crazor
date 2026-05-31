// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const mcpSource = readFileSync(resolve(repoRoot, "server/src/services/crazor-mcp.ts"), "utf8")

test("list_docs returns folder metadata for agent document discovery", () => {
  assert.ok(
    mcpSource.includes('case "list_docs": return listDocsForMcp(args.scope, args?.folder_id || null)'),
    "list_docs should use the MCP document tree response helper"
  )
  assert.ok(
    mcpSource.includes("if (!folderId) return { folders: tree.folders, notes: tree.notes }"),
    "list_docs without folder_id should return the full folder and note tree"
  )
  assert.ok(
    mcpSource.includes("folder.parent_id === folderId"),
    "list_docs with folder_id should return child folders of that folder"
  )
  assert.ok(
    mcpSource.includes("note.folder_id === folderId"),
    "list_docs with folder_id should return notes in that folder"
  )
})
