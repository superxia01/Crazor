// Copyright (c) 2026 MeeJoy
// 知识库完全复用 AI 笔记的组件，数据通过不同 scope 隔离

import { NotebookEditorPage } from "@/components/notebook/NotebookEditorPage"

export default function KnowledgeBaseView(props) {
  return (
    <NotebookEditorPage
      {...props}
      scope="knowledge"
    />
  )
}
