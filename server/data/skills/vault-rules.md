---
name: vault-rules
description: Crazor 知识库与数据操作规范（系统级，非数字员工）
trigger: 被要求创建、修改、管理文档或数据时自动加载
mcpTools: []
apis: []
dbTables: []
externalApis: []
system: true
---

# Crazor 数据操作规范

> 本规范定义了 Crazor 平台上所有数字员工的数据操作规则。每个数字员工通过 MCP Tool 统一访问数据，不直接操作文件系统。

---

## 1. 数据操作分流

### 结构化业务数据 → 数据库（通过 MCP Tool）

| 数据类型 | MCP Tool | 说明 |
|---------|----------|------|
| 客户/联系人 | create_contact, update_contact, list_contacts | contacts 表 |
| 收支记录 | create_transaction, list_transactions | transactions 表 |
| 项目 | create_project, update_project, list_projects | projects 表 |
| 任务 | create_task, move_task, list_tasks | tasks 表 |

**关键规则：** 客户信息、财务记录、项目任务 **必须** 通过数据库 MCP Tool 操作，不要创建 markdown 文件来存储这些结构化数据。

### 原始素材 → notebook scope（只进不改）

通过 `create_doc(scope="notebook")` 写入：
- 原始素材、碎片笔记、会议记录
- 客户沟通记录（传 contact_id 关联客户）

**关键规则：** notebook 是素材池，**只进不改**，写入后不可修改或删除。

### 结论与参考 → knowledge scope

通过 `create_doc(scope="knowledge")` 写入：
- 从素材提炼的结论、方法论
- 模板、指南、操作手册
- 行业知识、产品知识、客户洞察

**关键规则：** knowledge 只放提炼后的结论性内容，不放原始素材。

## 2. 核心原则

> **素材进 notebook，结论进 knowledge，结构化数据走数据库。**

- 原始素材 → `create_doc(scope="notebook")`
- 提炼结论 → `create_doc(scope="knowledge")`
- 客户/财务/项目/任务 → 对应的 DB MCP Tool

## 3. 关联规则

- 创建客户相关文档时，始终传入 `contact_id`
- 创建任务时传入 `project_id`
- 项目可关联客户 `contact_id`

## 4. MCP Tool 列表

### 数据库操作
- `create_contact`, `update_contact`, `list_contacts`, `get_contact`
- `create_transaction`, `update_transaction`, `list_transactions`, `get_finance_stats`
- `create_project`, `update_project`, `list_projects`
- `create_task`, `update_task`, `move_task`, `list_tasks`
- `get_contacts_stats`, `get_projects_stats`

### 文档操作
- `create_doc(scope, title, content, folder_id, contact_id)` — 创建文档
- `update_doc(id, title, content)` — 更新文档（仅 knowledge scope）
- `read_doc(id)` — 读取文档
- `list_docs(scope, folder_id)` — 列出文档
- `search_docs(scope, q)` — 搜索文档
- `create_folder(scope, name, parent_id)` — 创建文件夹
- `list_notes_by_contact(scope, contact_id)` — 查看客户关联文档
