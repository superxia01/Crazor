// Copyright (c) 2026 MeeJoy
// Crazor MCP Server — SSE transport, JSON-RPC 2.0

import {
  listContacts, getContact, createContact, updateContact, deleteContact,
  listTransactions, createTransaction, updateTransaction, deleteTransaction,
  getMonthlyRevenue, getContactStats, getFinanceStats, getProjectStats,
  listProjects, createProject, updateProject, deleteProject,
  listTasks, createTask, updateTask, deleteTask, moveTask,
} from "./crazor-db"
import * as docTree from "./crazor-doc-tree"

// ── SSE session management ───────────────────────────────────

const encoder = new TextEncoder()
const sessions = new Map<string, { controller: ReadableStreamDefaultController, initialized: boolean }>()

function sessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function sseSend(controller: ReadableStreamDefaultController, data: any) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

function jsonRpcResult(id: any, result: any) {
  return { jsonrpc: "2.0", id, result }
}

function jsonRpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

// ── Tool definitions ─────────────────────────────────────────

const TOOLS: any[] = [
  // --- Contacts ---
  {
    name: "create_contact",
    description: "创建联系人/客户",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "姓名（必填）" },
        company: { type: "string", description: "公司" },
        role: { type: "string", description: "职位" },
        phone: { type: "string", description: "手机号" },
        email: { type: "string", description: "邮箱" },
        wechat: { type: "string", description: "微信号" },
        stage: { type: "string", description: "阶段", enum: ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交", "已流失"] },
        source: { type: "string", description: "来源渠道", enum: ["公众号", "小红书", "转介绍", "抖音", "线下", "其他"] },
        level: { type: "string", description: "客户等级", enum: ["A", "B", "C", "D"] },
        deal: { type: "number", description: "成交金额" },
        tags: { type: "array", items: { type: "string" }, description: "标签" },
        remark: { type: "string", description: "备注" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_contact",
    description: "更新联系人信息",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "联系人ID（必填）" },
        name: { type: "string" }, company: { type: "string" }, role: { type: "string" },
        phone: { type: "string" }, email: { type: "string" }, wechat: { type: "string" },
        stage: { type: "string", enum: ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交", "已流失"] },
        source: { type: "string" }, level: { type: "string", enum: ["A", "B", "C", "D"] },
        status: { type: "string" }, deal: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        remark: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_contacts",
    description: "查询联系人列表",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "按阶段筛选" },
        level: { type: "string", description: "按等级筛选" },
        q: { type: "string", description: "搜索关键词（姓名/公司/职位）" },
      },
    },
  },
  {
    name: "get_contact",
    description: "获取联系人详情",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "联系人ID" } },
      required: ["id"],
    },
  },
  // --- Transactions ---
  {
    name: "create_transaction",
    description: "创建收支记录",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "类型", enum: ["income", "expense"] },
        amount: { type: "number", description: "金额" },
        date: { type: "string", description: "日期 YYYY-MM-DD" },
        category: { type: "string", description: "分类（服务/产品/人力/运营/市场/差旅/税费/其他）" },
        subcategory: { type: "string", description: "子分类" },
        contact_id: { type: "string", description: "关联客户ID" },
        description: { type: "string", description: "描述" },
        invoice_status: { type: "string", enum: ["none", "pending", "overdue"] },
        invoice_number: { type: "string", description: "发票号" },
        tax_amount: { type: "number", description: "税额" },
      },
      required: ["type", "amount", "date"],
    },
  },
  {
    name: "update_transaction",
    description: "更新收支记录",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }, type: { type: "string" }, amount: { type: "number" },
        date: { type: "string" }, category: { type: "string" }, description: { type: "string" },
        contact_id: { type: "string" }, invoice_status: { type: "string" },
        invoice_number: { type: "string" }, tax_amount: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_transactions",
    description: "查询收支记录列表",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"] },
        month: { type: "string", description: "月份 YYYY-MM" },
        category: { type: "string", description: "按分类筛选" },
      },
    },
  },
  {
    name: "get_finance_stats",
    description: "获取财务统计数据（总收入/支出/净利润）",
    inputSchema: {
      type: "object",
      properties: {
        months: { type: "number", description: "最近N个月的月度数据，默认6" },
      },
    },
  },
  // --- Projects ---
  {
    name: "create_project",
    description: "创建项目",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "项目名称" },
        description: { type: "string", description: "描述" },
        contact_id: { type: "string", description: "关联客户ID" },
        budget: { type: "number", description: "预算" },
        team: { type: "string", description: "团队成员（逗号分隔）" },
        start_date: { type: "string", description: "开始日期" },
        deadline: { type: "string", description: "截止日期" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_project",
    description: "更新项目",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }, name: { type: "string" }, description: { type: "string" },
        status: { type: "string" }, contact_id: { type: "string" }, budget: { type: "number" },
        team: { type: "string" }, start_date: { type: "string" }, deadline: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_projects",
    description: "查询项目列表",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "按状态筛选" },
      },
    },
  },
  // --- Tasks ---
  {
    name: "create_task",
    description: "创建任务",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "所属项目ID" },
        title: { type: "string", description: "任务标题" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        assignee: { type: "string", description: "负责人" },
        due_date: { type: "string", description: "截止日期" },
        estimated_hours: { type: "number", description: "预估工时" },
      },
      required: ["project_id", "title"],
    },
  },
  {
    name: "update_task",
    description: "更新任务",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
        priority: { type: "string" }, status: { type: "string" }, assignee: { type: "string" },
        due_date: { type: "string" }, estimated_hours: { type: "number" }, actual_hours: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "move_task",
    description: "移动任务到不同状态列（看板操作）",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "任务ID" },
        status: { type: "string", description: "目标状态", enum: ["todo", "doing", "done"] },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "list_tasks",
    description: "查询任务列表",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "按项目ID筛选" },
      },
    },
  },
  // --- Stats ---
  {
    name: "get_contacts_stats",
    description: "获取客户统计（总数、按阶段、按等级）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_projects_stats",
    description: "获取项目统计（项目数、任务数）",
    inputSchema: { type: "object", properties: {} },
  },
  // --- Documents ---
  {
    name: "create_doc",
    description: "创建知识库/AI笔记文档",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", description: "范围", enum: ["knowledge", "notebook"] },
        title: { type: "string", description: "标题" },
        content: { type: "string", description: "Markdown内容" },
        folder_id: { type: "string", description: "所属文件夹ID" },
        contact_id: { type: "string", description: "关联客户ID" },
      },
      required: ["scope", "title"],
    },
  },
  {
    name: "update_doc",
    description: "更新文档标题和内容",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "文档ID" },
        title: { type: "string" },
        content: { type: "string", description: "新的Markdown内容" },
      },
      required: ["id"],
    },
  },
  {
    name: "read_doc",
    description: "读取文档（含内容）",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "文档ID" } },
      required: ["id"],
    },
  },
  {
    name: "list_docs",
    description: "列出文件夹下的文档",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["knowledge", "notebook"] },
        folder_id: { type: "string", description: "文件夹ID（空则查根级）" },
      },
      required: ["scope"],
    },
  },
  {
    name: "search_docs",
    description: "搜索文档（按标题和内容）",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["knowledge", "notebook"] },
        q: { type: "string", description: "搜索关键词" },
      },
      required: ["scope", "q"],
    },
  },
  {
    name: "create_folder",
    description: "创建文件夹",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["knowledge", "notebook"] },
        name: { type: "string", description: "文件夹名称" },
        parent_id: { type: "string", description: "父文件夹ID" },
      },
      required: ["scope", "name"],
    },
  },
  {
    name: "read_vault_file",
    description: "读取知识库中的静态参考文件（品牌指南、产品清单等）",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "相对于知识库根目录的路径，如 '关于我/定位与品牌/IP定位.md'" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_notes_by_contact",
    description: "列出关联到指定客户的所有文档",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["knowledge", "notebook"] },
        contact_id: { type: "string", description: "客户ID" },
      },
      required: ["scope", "contact_id"],
    },
  },
]

// ── Tool execution ───────────────────────────────────────────

async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    // Contacts
    case "create_contact": return createContact(args)
    case "update_contact": return updateContact(args.id, args)
    case "list_contacts": return listContacts(args)
    case "get_contact": return getContact(args.id)

    // Transactions
    case "create_transaction": return createTransaction(args)
    case "update_transaction": return updateTransaction(args.id, args)
    case "list_transactions": return listTransactions(args)
    case "get_finance_stats": {
      const stats = getFinanceStats()
      const revenue = getMonthlyRevenue(args?.months || 6)
      return { ...stats, monthly: revenue }
    }

    // Projects
    case "create_project": return createProject(args)
    case "update_project": return updateProject(args.id, args)
    case "list_projects": return listProjects(args?.status)

    // Tasks
    case "create_task": return createTask(args)
    case "update_task": return updateTask(args.id, args)
    case "move_task": return moveTask(args.id, args.status)
    case "list_tasks": return listTasks(args?.project)

    // Stats
    case "get_contacts_stats": return getContactStats()
    case "get_projects_stats": return getProjectStats()

    // Documents
    case "create_doc": {
      // Find folder_id by name path if needed, or use provided folder_id
      return docTree.createNote(args.scope, args.folder_id || null, args.title, args.content, args.contact_id)
    }
    case "update_doc": {
      if (args.title && args.content !== undefined) {
        docTree.updateNote(args.id, args.title, args.content)
      } else if (args.content !== undefined) {
        const existing = docTree.getNote(args.id)
        if (existing) docTree.updateNote(args.id, existing.title, args.content)
      } else if (args.title) {
        const existing = docTree.getNote(args.id)
        if (existing) docTree.updateNote(args.id, args.title, existing.content || "")
      }
      return docTree.getNote(args.id)
    }
    case "read_doc": return docTree.getNote(args.id)
    case "list_docs": {
      const tree = docTree.listTree(args.scope)
      const notes = args.folder_id
        ? tree.notes.filter((n: any) => n.folder_id === args.folder_id)
        : tree.notes.filter((n: any) => !n.folder_id)
      return notes
    }
    case "search_docs": return docTree.searchNotes(args.scope, args.q)
    case "create_folder": return docTree.createFolder(args.scope, args.parent_id || null, args.name)
    case "read_vault_file": {
      const content = docTree.readVaultFile(args.path)
      if (content === null) throw new Error(`文件不存在: ${args.path}`)
      return { path: args.path, content }
    }
    case "list_notes_by_contact": return docTree.listNotesByContact(args.scope, args.contact_id)

    default: throw new Error(`Unknown tool: ${name}`)
  }
}

// ── JSON-RPC message handler ─────────────────────────────────

function handleMessage(message: any): any {
  const { id, method, params } = message

  switch (method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "crazor-mcp", version: "1.0.0" },
      })

    case "notifications/initialized":
      // Client notification, no response needed
      return null

    case "tools/list":
      return jsonRpcResult(id, { tools: TOOLS })

    case "tools/call": {
      const toolName = params?.name
      const toolArgs = params?.arguments || {}
      try {
        const result = executeTool(toolName, toolArgs)
        return jsonRpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        })
      } catch (err: any) {
        return jsonRpcResult(id, {
          content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
          isError: true,
        })
      }
    }

    case "ping":
      return jsonRpcResult(id, {})

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`)
  }
}

// ── SSE handlers (exported for index.ts) ──────────────────────

export function handleSSEConnect(): Response {
  const sid = sessionId()
  const stream = new ReadableStream({
    start(controller) {
      sessions.set(sid, { controller, initialized: false })
      // Send endpoint event so client knows where to POST
      controller.enqueue(encoder.encode(`event: endpoint\ndata: /mcp/sse?sessionId=${sid}\n\n`))
    },
    cancel() {
      sessions.delete(sid)
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

export function handleSSEMessage(body: any, sessionIdParam: string | null): any {
  // For notifications (no id), return null (no response)
  if (!body.id && body.method === "notifications/initialized") {
    const session = sessionIdParam ? sessions.get(sessionIdParam) : null
    if (session) session.initialized = true
    return null
  }

  const response = handleMessage(body)

  // Also send via SSE stream if session exists
  if (sessionIdParam && response) {
    const session = sessions.get(sessionIdParam)
    if (session) {
      sseSend(session.controller, response)
    }
  }

  return response
}
