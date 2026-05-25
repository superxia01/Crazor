---
name: dashboard
description: 数据看板 — 周报/月报生成、多维度数据汇总、关键指标追踪、复盘报告
trigger: 用户提到"周报"、"月报"、"数据看板"、"汇总"、"报表"、"复盘"、"KPI"、"指标"
mcpTools:
  - get_contacts_stats
  - get_content_piece_stats
  - content_check_daily
  - get_projects_stats
  - get_finance_stats
  - crm_get_pipeline
  - list_contacts
  - list_transactions
  - list_content_pieces
  - list_projects
  - list_tasks
  - create_doc
  - read_doc
  - search_docs
apis:
  - /api/crazor/contacts
  - /api/crazor/transactions
  - /api/crazor/content-pieces
  - /api/crazor/projects
  - /api/crazor/tasks
  - /api/crazor/docs
dbTables:
  - contacts
  - transactions
  - content_pieces
  - projects
  - tasks
  - doc_notes
externalApis: []
---

# 数据看板 Skill

> 本 Skill 通过 MCP 数据库工具读取业务数据，再用 MCP 文档工具生成并保存报告文档。

---

## 1. 可用 MCP 工具

### 数据库查询工具（只读）

| 工具 | 用途 | 返回数据 |
|------|------|----------|
| **get_contacts_stats** | 客户/CRM 统计 | 客户总数、新增客户、转化率等 |
| **get_projects_stats** | 项目统计 | 项目数量、完成率、延期率等 |
| **get_finance_stats** | 财务统计 | 收入、支出、利润、现金流等 |
| **list_contacts** | 客户列表 | 客户详细信息 |
| **list_transactions** | 交易列表 | 交易流水明细 |
| **list_projects** | 项目列表 | 项目详细信息 |
| **list_tasks** | 任务列表 | 任务完成情况 |

### 文档操作工具

| 工具 | 用途 | 关键参数 |
|------|------|----------|
| **create_doc** | 创建报告文档 | `scope="knowledge"`, `title`, `content` |
| **read_doc** | 读取已有报告 | `id` |
| **list_docs** | 列出文档列表 | `scope="knowledge"`, `folder_id` |
| **search_docs** | 搜索文档 | `scope="knowledge"`, `q` |

---

## 2. 知识库报告结构

所有报告文档存储在 `业务流程/数据看板/` 文件夹下：

| 报告类型 | 存储路径 | 文档标题格式 |
|----------|----------|-------------|
| 周报 | `业务流程/数据看板/` | `W{{XX}}周报-{{MM.DD}}-{{MM.DD}}` |
| 月报 | `业务流程/数据看板/` | `{{YYYY}}年{{MM}}月月报` |
| 季度复盘 | `业务流程/数据看板/` | `{{YYYY}}年Q{{N}}季度复盘` |
| KPI追踪 | `业务流程/数据看板/` | `年度KPI追踪` / `月度KPI追踪` |
| 看板索引 | `业务流程/数据看板/` | `看板索引` |

---

## 3. 工作流程

### 3.1 生成周报

当用户说"生成本周周报"时：

```
步骤 1：确定报告周期（本周一 ~ 本周日）

步骤 2：从数据库采集本周数据
        → get_contacts_stats()      → 客户维度数据
        → get_projects_stats()      → 项目维度数据
        → get_finance_stats()       → 财务维度数据
        → list_tasks()              → 本周完成任务明细
        → list_transactions()       → 本周交易流水

步骤 3：查找上周报告用于环比对比
        → search_docs(scope="knowledge", q="周报")

步骤 4：计算各指标环比变化

步骤 5：组装报告 Markdown 内容（按周报模板）

步骤 6：create_doc(
          scope="knowledge",
          title="W{{XX}}周报-{{MM.DD}}-{{MM.DD}}",
          content=<组装好的周报内容>
        )

步骤 7：向用户展示报告摘要
```

### 3.2 生成月报

当用户说"生成本月月报"时：

```
步骤 1：确定报告周期（本月1日 ~ 月末）

步骤 2：从数据库采集本月数据
        → get_finance_stats()       → 收入/支出/利润
        → get_contacts_stats()      → 新客户数/成交金额/转化率
        → get_projects_stats()      → 项目完成数/延期率
        → list_transactions()       → 交易明细（用于趋势分析）
        → list_projects()           → 项目详情
        → list_tasks()              → 任务完成情况

步骤 3：查找上月报告用于环比对比
        → search_docs(scope="knowledge", q="月报")
        → read_doc(id=上月月报文档ID)

步骤 4：计算环比变化和趋势分析

步骤 5：组装月报 Markdown 内容（按月报模板）

步骤 6：create_doc(
          scope="knowledge",
          title="{{YYYY}}年{{MM}}月月报",
          content=<组装好的月报内容>
        )

步骤 7：向用户展示报告摘要和关键发现
```

### 3.3 季度复盘

当用户说"季度复盘"时：

```
步骤 1：确定季度范围（Q1: 1-3月 / Q2: 4-6月 / Q3: 7-9月 / Q4: 10-12月）

步骤 2：汇总季度数据
        → get_finance_stats()       → 季度财务汇总
        → get_contacts_stats()      → 季度客户数据
        → get_projects_stats()      → 季度项目交付
        → list_transactions()       → 季度交易明细
        → list_contacts()           → 客户列表
        → list_projects()           → 项目列表

步骤 3：查找上季度复盘和本季度3个月报
        → search_docs(scope="knowledge", q="复盘")
        → search_docs(scope="knowledge", q="月报")

步骤 4：对比季度环比数据，识别趋势

步骤 5：组装复盘 Markdown 内容（按季度复盘模板）

步骤 6：create_doc(
          scope="knowledge",
          title="{{YYYY}}年Q{{N}}季度复盘",
          content=<组装好的复盘内容>
        )
```

### 3.4 KPI 追踪

```
步骤 1：search_docs(scope="knowledge", q="年度KPI追踪") → 读取KPI目标
        若不存在则 create_doc 创建

步骤 2：从数据库获取最新数据
        → get_finance_stats()       → 财务指标完成情况
        → get_contacts_stats()      → 客户指标完成情况
        → get_projects_stats()      → 项目指标完成情况

步骤 3：计算各KPI完成进度

步骤 4：update_doc 更新KPI追踪文档
        偏差超过20%的KPI标记为预警状态
```

---

## 4. 报告模板

### 4.1 周报模板

```markdown
# 第 W{{XX}} 周报（{{MM.DD}} - {{MM.DD}}）

> 生成日期：YYYY-MM-DD

## 一周概览

| 维度 | 本周 | 上周 | 环比 | 目标 | 达成率 |
|------|------|------|------|------|--------|
| 财务-收入 | ¥ | ¥ | % | ¥ | % |
| 财务-支出 | ¥ | ¥ | % | | |
| 项目-完成任务 | | | | | % |
| CRM-新客户 | | | | | % |
| CRM-成交额 | ¥ | ¥ | % | ¥ | % |

## 本周亮点

<!-- 2-3条本周值得关注的成就 -->
1.
2.
3.

## 本周问题

<!-- 需要关注的问题和风险 -->
1.
2.

## 各维度详情

### 财务

- 本周收入：¥（主要来源：）
- 本周支出：¥（主要去向：）
- 异常项：

### 项目进展

| 项目 | 本周完成 | 下周计划 | 风险 |
|------|----------|----------|------|
|      |          |          |      |

### 客户动态

- 新增客户：
- 成交客户：
- 需要跟进：

## 下周重点

1.
2.
3.
```

### 4.2 月报模板

```markdown
# {{YYYY}}年{{MM}}月 月报

> 生成日期：YYYY-MM-DD

## 月度概览

| 维度 | 本月 | 上月 | 环比 | 目标 | 达成率 | 状态 |
|------|------|------|------|------|--------|------|
| 总收入 | ¥ | ¥ | % | ¥ | % | 达标/接近/未达 |
| 总支出 | ¥ | ¥ | % | | | |
| 净利润 | ¥ | ¥ | % | ¥ | % | |
| 新客户数 | | | | | % | |
| 成交总额 | ¥ | ¥ | % | ¥ | % | |
| 项目完成数 | | | | | % | |

## 趋势分析

### 收入趋势

| 月份 | 收入 | 支出 | 利润 |
|------|------|------|------|
| {{MM-2}}月 | | | |
| {{MM-1}}月 | | | |
| **{{MM}}月** | | | |

### 关键发现

<!-- 基于数据的洞察 -->
1.
2.
3.

## 月度亮点

1.
2.
3.

## 需改进项

| 问题 | 影响 | 改进措施 | 负责人 | 截止日期 |
|------|------|----------|--------|----------|
|      |      |          |        |          |

## KPI 完成情况

| KPI | 年度目标 | 月度目标 | 本月实际 | 累计完成 | 年度进度 |
|-----|----------|----------|----------|----------|----------|
|     |          |          |          |          | % |

## 下月计划

| 优先级 | 计划事项 | 预期结果 | 负责人 |
|--------|----------|----------|--------|
| 高 | | | |
| 中 | | | |
| 低 | | | |

## 管理建议

<!-- 基于数据给出的2-3条管理建议 -->
1.
2.
3.
```

### 4.3 季度复盘模板

```markdown
# {{YYYY}}年 Q{{N}} 季度复盘

> 复盘日期：YYYY-MM-DD

## 1. 目标回顾

| 目标 | Q{{N}}目标 | 实际结果 | 达成率 | 评价 |
|------|-----------|----------|--------|------|
|      |           |          | % | 达标/接近/未达 |

## 2. 数据全景

| 维度 | Q{{N-1}} | Q{{N}} | 季环比 |
|------|----------|--------|--------|
| 累计收入 | ¥ | ¥ | % |
| 累计利润 | ¥ | ¥ | % |
| 团队规模 | | | |
| 客户总数 | | | |
| 项目交付 | | | |

## 3. 做得好的

<!-- 保持和发扬的 -->
1.
2.
3.

## 4. 不足之处

<!-- 需要改进的 -->
1.
2.
3.

## 5. 经验教训

<!-- 深度反思 -->
1.
2.

## 6. 下季度计划

| # | 计划 | 目标 | 负责人 | 优先级 |
|---|------|------|--------|--------|
| 1 | | | | 高 |
| 2 | | | | 中 |
| 3 | | | | 低 |
```

---

## 5. 业务规则

1. **数据来源**：报告数据来自 MCP 数据库工具（get_*_stats, list_*），确保调用时获取最新数据
2. **报告时效**：周报在每周一上午生成，月报在每月1-3号生成
3. **对比维度**：至少提供环比数据；通过 `search_docs` 查找历史报告实现同比对比
4. **达成率标记**：>=100% 达标 / 80-99% 接近 / <80% 未达
5. **行动导向**：报告不仅是数据汇总，必须有改进建议和下期计划
6. **数据完整性**：生成报告前，确保所有数据库工具调用都返回了有效结果
7. **报告存档**：每次生成报告通过 `create_doc` 保存到知识库，便于后续对比引用
8. **索引维护**：每次生成报告后，更新看板索引文档

---

## 6. 数据查询速查

| 数据需求 | MCP 调用 |
|----------|----------|
| 客户总数、新增、转化率 | `get_contacts_stats()` |
| 项目数量、完成率、延期率 | `get_projects_stats()` |
| 收入、支出、利润、现金流 | `get_finance_stats()` |
| 客户详细信息列表 | `list_contacts()` |
| 交易流水明细 | `list_transactions()` |
| 项目详细信息列表 | `list_projects()` |
| 任务完成情况列表 | `list_tasks()` |
| 上周/上月报告内容 | `search_docs(q="周报"/"月报")` → `read_doc(id)` |

---

## 7. 常见操作速查

| 用户说 | 操作 | MCP 调用 |
|--------|------|----------|
| "本周周报" | 采集数据 → 生成周报 → 保存文档 | `get_*_stats` + `list_*` + `create_doc` |
| "本月月报" | 采集数据 → 生成月报 → 保存文档 | `get_*_stats` + `list_*` + `search_docs` + `create_doc` |
| "数据看板" | 展示各维度关键指标 | `get_contacts_stats` + `get_projects_stats` + `get_finance_stats` |
| "季度复盘" | 季度数据汇总 → 生成复盘 → 保存文档 | `get_*_stats` + `list_*` + `search_docs` + `create_doc` |
| "KPI完成得怎么样" | 读取KPI追踪文档 + 更新最新数据 | `search_docs` → `read_doc` + `get_*_stats` |
| "和上月比怎么样" | 对比本月与上月数据 | `get_*_stats` + `search_docs` → `read_doc` |
| "哪个指标下降了" | 识别环比下降的指标 | `get_*_stats` + `search_docs` → `read_doc` → 对比分析 |
