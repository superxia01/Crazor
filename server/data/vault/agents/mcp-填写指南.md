# 50-mcp MCP 服务接入

存放 Model Context Protocol (MCP) 服务器的接入配置与接口文档。

## 用途
- MCP Server 配置文件
- 工具接口定义
- 服务连接参数
- API 密钥与认证配置（注意安全）

## 文件命名
- 格式：`{服务名}-mcp.json` 或 `{服务名}-说明.md`
- 示例：`filesystem-mcp.json`、`web-search-说明.md`

## 管理者
**AI 配置 → 人审核敏感权限**

## 文件流转
- **输入**：MCP 服务提供方的接口文档
- **输出**：被 `40-效率工具/` 和 `70-integrations/` 引用
