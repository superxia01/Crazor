# 产品持续审计入口

> 更新日期：2026-05-28
> 审计范围：Crazor Web、Crazor Server、MCP Server、Docker 交付、Hermes 默认 Provider、业务数据与文档知识库链路。

## 审计目标

持续确认 Crazor 是否具备“团队协作 + Agent 驱动业务管理”的真实闭环能力：

- 功能是否真实存在，不以说明文案或 mock 数据代替可操作功能。
- 页面、API、数据库、文档、MCP Tool、Agent Provider 之间的关系是否闭合。
- Docker 内网交付是否可复现、可验证、可持续维护。
- Hermes 当前作为默认 Provider 是否保持可解耦，不污染 Crazor 业务层。
- 缺失能力是否被明确记录为待办，而不是被 UI 或文档掩盖。

## 文档结构

- [产品功能地图](product-function-map.md)：模块、页面、API、数据层、MCP 能力的对应关系。
- [审计问题台账](findings.md)：当前发现的问题、风险等级、影响范围和建议修复顺序。

## 当前结论

当前代码已经具备 Docker 化交付、统一 Web 入口、业务数据 API、文档知识库、Hermes 对话/技能/记忆/任务管理等基础能力。

但从“团队内部真实使用”的标准看，产品还不是完整闭环。核心差距在于：

- 业务页面多数是“可看、部分可拖拽”，但新增、编辑、表单、关联动作没有形成统一的人类操作闭环。
- 后端业务 API 与 MCP Tool 已经比较完整，但前端没有完全承接这些写入能力。
- 多人协作所需的身份、权限、审计日志、操作者归因仍处于愿景文档阶段。
- Agent Gateway 的解耦原则已有文档，但代码和 UI 里仍有较多 Hermes 私有概念。

## 本轮烟测

通过局域网入口 `http://192.168.103.4:5173` 验证：

| 链路 | 结果 |
|------|------|
| Docker 服务状态 | `crazor-server`、`crazor-web`、`hermes` 均 healthy |
| `/api/health` | 200 |
| `/api/status` | 200 |
| `/api/model/info` | 200 |
| `/api/skills` | 200 |
| `/api/skills/market` | 200，约 193KB |
| `/api/crazor/contacts` | 200，当前为空数组 |
| `/api/crazor/content-pieces` | 200，有正式模板/内容记录 |
| `/api/crazor/transactions` | 200，当前为空数组 |
| `/api/crazor/projects` | 200，当前为空数组 |
| `/api/crazor/tasks` | 200，当前为空数组 |
| `/api/crazor/channels` | 200，当前为空数组 |
| `/api/crazor/analytics/overview` | 200 |
| `/api/crazor/docs/knowledge/tree` | 200 |
| `/api/workspaces` | 200 |
| `/api/sessions` | 200 |

空数组不视为错误。当前部署默认 `CRAZOR_SEED_DEMO_DATA=false`，符合“不用 mock 数据误导真实链路”的要求。

## 持续审计规则

- 每次新增功能必须更新功能地图或问题台账。
- 每次发现“UI 展示了但链路未打通”的功能，必须进入问题台账。
- 临时验证数据用完即删，不能混入正式运行数据。
- 文档使用中文记录，英文仅保留代码名、协议名、API 名称和必要产品名。
- 审计文档保持小文件拆分，不把所有内容堆进单个巨型文档。
