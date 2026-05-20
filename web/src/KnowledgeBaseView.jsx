// Copyright (c) 2026 MeeJoy

import { lazy } from "react"

const NotebookEditorPage = lazy(() =>
  import("@/components/notebook/NotebookEditorPage.jsx")
)

export default function KnowledgeBaseView(props) {
  return <NotebookEditorPage {...props} />
}
