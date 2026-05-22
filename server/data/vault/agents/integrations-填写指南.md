# 70-integrations 外部集成

存放与外部系统和平台的集成配置，连接 AI 层与外部服务。

## 用途
- 社交媒体平台 API 配置
- 数据库连接配置
- 云服务集成
- Webhook 与回调配置

## 文件命名
- 格式：`{平台/服务}-integration.md`
- 示例：`Notion-integration.md`、`Slack-integration.md`

## 管理者
**AI 生成配置 → 人审核敏感信息**

## 文件流转
- **输入**：引用 `50-mcp/` 的服务配置
- **输出**：集成数据流入 `20-raw/`，处理结果流入 `40-flow/`
