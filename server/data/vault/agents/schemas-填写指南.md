# 10-schemas 数据结构定义

存放所有 AI 处理中使用的数据 Schema 定义，确保输入输出格式统一规范。

## 用途
- 定义 Markdown 文件的 YAML Frontmatter 结构
- 定义 JSON 数据交换格式
- 定义数据库/表格字段规范

## 文件命名
- 格式：`{领域}-{对象}.schema.md`
- 示例：`内容-BlogPost.schema.md`、`财务-发票.schema.md`

## 管理者
**AI 生成初稿 → 人审核确认**

## 文件流转
- **输入**：来自业务需求变更
- **输出**：供 `20-templates/`、`40-automations/`、`70-integrations/` 引用
