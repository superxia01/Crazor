---
name: vault-rules
description: Crazor 知识库与数据操作规范（系统级，非数字员工）
trigger: 被要求在知识库中创建、修改、管理文件时自动加载
mcpTools: []
apis: []
dbTables: []
externalApis: []
---

# Crazor 数据操作规范

> 本规范定义了 Crazor 平台上所有数字员工的数据操作规则。每个数字员工通过 MCP Tool 统一访问数据，不直接操作文件系统。

---

## 1. 知识库目录结构

```
知识库 (knowledge scope)
├── 关于我/                        # 个人/公司配置（静态参考）
│   ├── 定位与品牌/                # IP定位、品牌风格指南、个人故事
│   ├── 产品与业务/                # 产品清单、价格体系、交付标准
│   ├── 目标客户/                  # 客户画像、分层标准
│   ├── 账号矩阵/                  # 平台账号信息
│   └── 目标与节奏/                # 商业目标、工作节奏
├── 百科/                          # 知识卡片（AI整理的结构化知识）
│   ├── 行业与市场/
│   ├── 产品知识/
│   ├── 客户洞察/
│   ├── 销售与转化/
│   ├── 内容与流量/
│   └── 实战复盘/
├── 业务流程/                      # 日常运营产出
│   ├── 公域流量/                  # 选题池、内容管理、数据统计、内容资产、素材提炼
│   ├── 私域运营/                  # 朋友圈、社群、数据周报
│   ├── 客户管理/                  # 线索管理、成交记录
│   ├── 产品交付/
│   ├── 项目管理/
│   ├── 人事管理/
│   ├── 财务管理/
│   ├── 库存管理/
│   └── 数据看板/
├── 素材资产/                      # 品牌、账号、模板、报价、合同
├── 事件/                          # 公司、AI
└── 归档/

AI笔记 (notebook scope)
└── inbox/                         # 原始素材、碎片笔记
```

## 2. 数据操作分类

### 结构化业务数据 → 数据库（通过 MCP Tool）

| 数据类型 | MCP Tool | 说明 |
|---------|----------|------|
| 客户/联系人 | create_contact, update_contact, list_contacts | contacts 表 |
| 收支记录 | create_transaction, list_transactions | transactions 表 |
| 项目 | create_project, update_project, list_projects | projects 表 |
| 任务 | create_task, move_task, list_tasks | tasks 表 |

**关键规则：** 客户信息、财务记录、项目任务 **必须** 通过数据库 MCP Tool 操作，不要创建 markdown 文件来存储这些结构化数据。

### 文档/知识内容 → 文档系统（通过 MCP Tool）

| 数据类型 | MCP Tool | 说明 |
|---------|----------|------|
| 知识卡片 | create_doc (scope="knowledge") | 百科/下各子目录 |
| 跟进记录 | create_doc (contact_id=xxx) | 关联到客户 |
| 内容草稿 | create_doc (scope="knowledge") | 业务流程/下 |
| 会议纪要 | create_doc (scope="knowledge") | 可关联 project 或 contact |
| 报告 | create_doc (scope="knowledge") | 周报/月报等 |

### 静态参考文件 → 只读（通过 read_vault_file）

通过 `read_vault_file(path)` 读取，不要修改：
- `关于我/定位与品牌/IP定位.md`
- `关于我/产品与业务/产品与服务清单.md`
- `关于我/目标客户/目标客户画像.md`
- `百科/销售与转化/谈单方法论.md`
- 其他配置类文件

## 3. 关联规则

### 客户关联文档
创建客户相关文档时，始终传入 `contact_id`：
```
create_doc({
  scope: "knowledge",
  title: "张三-合作方案",
  content: "...",
  contact_id: "客户ID"
})
```
这样在客户详情页自动显示所有关联文档。

### 项目关联任务
创建任务时传入 `project_id`，项目可关联客户 `contact_id`。

## 4. 通用 MCP Tool 列表

### 数据库操作
- `create_contact`, `update_contact`, `list_contacts`, `get_contact`
- `create_transaction`, `update_transaction`, `list_transactions`, `get_finance_stats`
- `create_project`, `update_project`, `list_projects`
- `create_task`, `update_task`, `move_task`, `list_tasks`
- `get_contacts_stats`, `get_projects_stats`

### 文档操作
- `create_doc(scope, title, content, folder_id, contact_id)` — 创建文档
- `update_doc(id, title, content)` — 更新文档
- `read_doc(id)` — 读取文档（含内容）
- `list_docs(scope, folder_id)` — 列出文档
- `search_docs(scope, q)` — 搜索文档
- `create_folder(scope, name, parent_id)` — 创建文件夹
- `read_vault_file(path)` — 读取静态参考文件
- `list_notes_by_contact(scope, contact_id)` — 查看客户关联文档
