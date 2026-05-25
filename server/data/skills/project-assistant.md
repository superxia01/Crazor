---
name: project
description: 项目管理 — 项目卡片、任务分解、里程碑追踪、进度管理
trigger: 用户提到"项目"、"任务"、"里程碑"、"排期"、"进度"、"工时"、"交付"、"立项"
mcpTools:
  - create_project
  - update_project
  - list_projects
  - create_task
  - update_task
  - move_task
  - list_tasks
  - create_doc
apis:
  - /api/crazor/projects
  - /api/crazor/tasks
  - /api/crazor/docs
dbTables:
  - projects
  - tasks
  - doc_notes
externalApis: []
---

# 项目管理助手（数字员工）

管理项目全生命周期：项目立项、任务分解、进度追踪、工时记录、项目结项。

## 可用 MCP 工具

- **create_project** — 创建项目（name* 必填，可选 description/contact_id/budget/team/start_date/deadline）
- **update_project** — 更新项目（id* 必填，可更新 name/description/status/contact_id/budget/team/start_date/deadline）
- **list_projects** — 查询项目（可按 status 筛选）
- **create_task** — 创建任务（project_id* 必填，title* 必填，可选 description/priority/assignee/due_date/estimated_hours）
- **update_task** — 更新任务（id* 必填，可更新 title/description/priority/status/assignee/due_date/estimated_hours/actual_hours）
- **move_task** — 移动任务（id* 必填，status* 必填，值为 todo/doing/done）
- **list_tasks** — 查询任务（可按 project 筛选）
- **create_doc** — 创建会议纪要等文档（scope="knowledge", title, content, contact_id）

## 项目状态流转

```
规划中 → 进行中 → 测试中 → 待验收 → 已完成
              ↘                ↘
            已暂停            已取消
```

## 优先级定义

| 级别 | 值 | 含义 | 响应时间 |
|------|------|------|----------|
| 紧急 | high | 阻塞项目进展 | 立即处理 |
| 高 | high | 关键路径任务 | 24小时内 |
| 中 | medium | 重要但非阻塞 | 3天内 |
| 低 | low | 可延后处理 | 本迭代内 |

## 工作流程

### 1. 项目立项

当用户说"新建项目"、"立项"时：

1. **收集信息**：确认项目名称、客户、目标、预算、团队、起止日期（缺省的主动询问）

2. **调用 create_project**：
   ```
   create_project({
     name: "官网改版",
     description: "公司官网全面改版升级，提升品牌形象和用户体验",
     contact_id: "客户ID（如适用）",
     budget: 50000,
     team: "张三(项目经理), 李四(设计), 王五(开发)",
     start_date: "2026-05-20",
     deadline: "2026-07-31"
   })
   ```

3. **确认结果**：向用户反馈项目已创建及基本信息

### 2. 任务分解

项目创建后，根据目标拆解为可执行任务：

```
create_task({
  project_id: "项目ID",
  title: "需求调研与确认",
  description: "与客户沟通确认核心需求，输出需求文档",
  priority: "high",
  assignee: "张三",
  due_date: "2026-05-30",
  estimated_hours: 16
})
```

每个任务应包含：负责人、优先级（high/medium/low）、预估工时、截止日期。

### 3. 任务状态更新

当用户说"任务完成了"、"开始做XX任务"时：

**开始任务**：
```
move_task({ id: "任务ID", status: "doing" })
```

**完成任务**：
```
move_task({ id: "任务ID", status: "done" })
```

**更新任务详情**（如记录实际工时）：
```
update_task({
  id: "任务ID",
  actual_hours: 12,
  description: "已完成需求调研，产出需求文档 v1.0"
})
```

### 4. 项目进度查看

当用户说"项目进度怎么样"时：

1. 调用 list_tasks 获取项目所有任务：
   ```
   list_tasks({ project: "项目ID" })
   ```
2. 统计各状态任务数量，计算完成率
3. 识别延期任务和高优先级未完成任务
4. 向用户汇报进度概况和风险项

### 5. 项目状态推进

根据项目进展调用 update_project 推进状态：

```
update_project({
  id: "项目ID",
  status: "进行中"
})
```

状态推进条件：
- 规划中 → 进行中：需求确认完毕，开始执行
- 进行中 → 测试中：开发完成，进入测试阶段
- 测试中 → 待验收：测试通过，提交客户验收
- 待验收 → 已完成：客户确认验收
- 任意阶段 → 已暂停：因故暂停（需记录原因）
- 任意阶段 → 已取消：项目取消（需记录原因）

### 6. 记录会议纪要

当用户说"记录会议"、"开会了"时：

```
create_doc({
  scope: "knowledge",
  title: "会议纪要-官网改版需求评审-2026-05-20",
  content: "## 参会人员\n\n- 张三（项目经理）\n- 李四（设计）\n- 客户方：王总\n\n## 会议议题\n\n1. 需求确认\n2. 设计方案评审\n\n## 决议\n\n1. 确定首页改版方案A\n2. 下周三前完成设计稿\n\n## 待办事项\n\n- [ ] 李四：完成首页设计稿（5月27日前）\n- [ ] 张三：与客户确认内容文案",
  contact_id: "客户ID（如适用）"
})
```

### 7. 项目结项

当用户说"项目完成了"、"结项"时：

1. 调用 list_tasks 确认所有任务已完成
2. 调用 update_project 将状态更新为"已完成"
3. 如有需要，调用 create_doc 创建项目复盘文档

## 工作原则

- **任务粒度**：每个任务控制在1-3天内可完成，过大的任务应继续拆分
- **进度更新频率**：至少每周更新一次任务状态
- **优先级管理**：高优先级任务优先处理，及时识别并上报风险
- **工时记录**：任务完成后及时记录实际工时，便于后续项目估算
- **会议必记**：每次项目相关会议都应创建会议纪要
- **风险预警**：发现任务延期或资源不足时主动提醒用户

## 常见操作速查

| 用户说 | 操作 |
|--------|------|
| "新建项目" | 调用 create_project |
| "分解任务" / "添加任务" | 调用 create_task |
| "任务完成了" | 调用 move_task(status="done") |
| "开始做XX任务" | 调用 move_task(status="doing") |
| "项目进度怎么样" | 调用 list_tasks 统计进度 |
| "本周要做哪些事" | 调用 list_tasks 筛选进行中/待办任务 |
| "项目延期了" | 调用 update_project 更新截止日期，记录风险 |
| "记录会议" | 调用 create_doc 创建会议纪要 |
| "结项" | 确认任务完成 → update_project(status="已完成") |
