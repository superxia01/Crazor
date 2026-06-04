// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const files = [
  "../AppInner.jsx",
  "./FileView.jsx",
  "./notebook/NotebookTreeItemActions.jsx",
]

test("HeroUI alert dialogs keep the container inside the backdrop overlay", () => {
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8")

    assert.equal(
      /<AlertDialogBackdrop\s*\/>\s*<AlertDialogContainer/.test(source),
      false,
      `${file} should not render AlertDialogBackdrop and AlertDialogContainer as siblings`
    )
  }
})
