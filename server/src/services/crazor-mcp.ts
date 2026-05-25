// Copyright (c) 2026 MeeJoy
// Crazor MCP Server — SSE transport, JSON-RPC 2.0

import {
  listContacts, getContact, createContact, updateContact, deleteContact,
  listTransactions, createTransaction, updateTransaction, deleteTransaction,
  getMonthlyRevenue, getContactStats, getFinanceStats, getProjectStats,
  listProjects, createProject, updateProject, deleteProject,
  listTasks, createTask, updateTask, deleteTask, moveTask,
  listFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, getFollowUpReminders,
  listChannels, getChannel, createChannel, updateChannel, deleteChannel, getChannelStats,
  listChannelReferrals, createChannelReferral,
  crmGetClient, crmAddClient, crmAddFollowup, crmUpdateStage, crmRecordDeal,
  crmListOverdue, crmGetPipeline, crmSearch,
  listContentPieces, getContentPiece, createContentPiece,
  updateContentPiece, deleteContentPiece, getContentPieceStats,
  contentPublish, contentUpdateMetrics, contentCheckDaily,
  getbijiSync, getbijiStatus, getbijiForceFull,
} from "./crazor-db"
import { listFieldDefinitions, createFieldDefinition, discoverCustomFields } from "./field-definitions"
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
        stage: { type: "string", description: "阶段", enum: ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交", "已流失", "Lead", "Qualified", "Opportunity", "Proposal", "Closed Won", "Closed Lost"] },
        source: { type: "string", description: "来源渠道", enum: ["公众号", "小红书", "转介绍", "抖音", "线下", "其他"] },
        level: { type: "string", description: "客户评级", enum: ["A", "B", "C", "D", "已合作", "高意向", "一般般", "观望中", "不回复"] },
        deal: { type: "number", description: "成交金额" },
        tags: { type: "array", items: { type: "string" }, description: "标签" },
        remark: { type: "string", description: "备注" },
        sales_person: { type: "string", description: "内部Sales（负责销售）" },
        project_type: { type: "string", description: "所属项目", enum: ["建站", "技术服务", "培训", "AI技术", "APP&小程序", "课程", "企业培训"] },
        budget_range: { type: "string", description: "预算范围" },
        next_follow_up: { type: "string", description: "计划跟进日期 YYYY-MM-DD" },
        identity: { type: "string", description: "身份", enum: ["企业主", "职场人", "自由职业", "学生", "其他", "企业"] },
        situation: { type: "string", description: "情况说明（背景描述）" },
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
        stage: { type: "string", enum: ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交", "已流失", "Lead", "Qualified", "Opportunity", "Proposal", "Closed Won", "Closed Lost"] },
        source: { type: "string" }, level: { type: "string", enum: ["A", "B", "C", "D", "已合作", "高意向", "一般般", "观望中", "不回复"] },
        status: { type: "string" }, deal: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        remark: { type: "string" },
        sales_person: { type: "string" }, project_type: { type: "string" },
        budget_range: { type: "string" }, next_follow_up: { type: "string" },
        identity: { type: "string" }, situation: { type: "string" },
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
    description: "创建收支记录/业绩流水",
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
        quote: { type: "number", description: "报价" },
        product_type: { type: "string", description: "产品/项目（建站/技术服务/培训/AI技术等）" },
        progress: { type: "string", description: "进度", enum: ["进行中", "完成", "已完成", "已关闭", "开发中"] },
        payment_status: { type: "string", description: "回款状态", enum: ["已回款", "部分回款", "未回款", "已付款", "已退款"] },
        payment_channel: { type: "string", description: "收款渠道" },
        channel_id: { type: "string", description: "关联渠道ID" },
      },
      required: ["type", "amount", "date"],
    },
  },
  {
    name: "update_transaction",
    description: "更新收支记录/业绩流水",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }, type: { type: "string" }, amount: { type: "number" },
        date: { type: "string" }, category: { type: "string" }, description: { type: "string" },
        contact_id: { type: "string" }, invoice_status: { type: "string" },
        invoice_number: { type: "string" }, tax_amount: { type: "number" },
        quote: { type: "number" }, product_type: { type: "string" },
        progress: { type: "string" }, payment_status: { type: "string" },
        payment_channel: { type: "string" }, channel_id: { type: "string" },
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
  // --- Follow-ups ---
  {
    name: "create_follow_up",
    description: "创建跟进记录",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "客户ID（必填）" },
        date: { type: "string", description: "跟进日期 YYYY-MM-DD" },
        method: { type: "string", description: "跟进方式", enum: ["微信", "面谈", "电话", "群聊"] },
        content: { type: "string", description: "沟通内容" },
        next_step: { type: "string", description: "下一步计划" },
        status: { type: "string", description: "跟进状态", enum: ["已完成", "已跟进", "待跟进"] },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "list_follow_ups",
    description: "查询跟进记录",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "按客户ID筛选" },
        status: { type: "string", description: "按状态筛选" },
        date_from: { type: "string", description: "开始日期" },
        date_to: { type: "string", description: "结束日期" },
      },
    },
  },
  {
    name: "update_follow_up",
    description: "更新跟进记录",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "跟进记录ID（必填）" },
        date: { type: "string" }, method: { type: "string" },
        content: { type: "string" }, next_step: { type: "string" },
        status: { type: "string", enum: ["已完成", "已跟进", "待跟进"] },
      },
      required: ["id"],
    },
  },
  {
    name: "get_follow_up_reminders",
    description: "获取待跟进提醒（今日到期及逾期）",
    inputSchema: { type: "object", properties: {} },
  },
  // --- Channels ---
  {
    name: "create_channel",
    description: "创建渠道档案（合作渠道/公域渠道）",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "合作方名称（必填）" },
        contact_person: { type: "string", description: "联系人" },
        wechat: { type: "string", description: "微信号" },
        phone: { type: "string", description: "电话" },
        company_type: { type: "string", description: "类型", enum: ["个人", "公司", "MCN", "培训机构", "代运营", "其他"] },
        company_name: { type: "string", description: "公司/机构名" },
        cooperation_mode: { type: "string", description: "合作模式", enum: ["返佣", "分成", "互推", "一次性推荐", "代理", "课程分销", "其他"] },
        commission_rate: { type: "string", description: "佣金/分成比例" },
        settlement_method: { type: "string", description: "结算方式", enum: ["单次结算", "月结", "季结"] },
        status: { type: "string", description: "状态", enum: ["活跃", "休眠", "已终止"] },
        rating: { type: "string", description: "评级", enum: ["核心", "一般", "潜力"] },
        main_products: { type: "string", description: "主要引入产品类型" },
        is_public: { type: "number", description: "是否公域渠道（0=否，1=是）" },
        account_name: { type: "string", description: "公域账号名" },
        platform_id: { type: "string", description: "平台ID" },
        followers: { type: "number", description: "粉丝数" },
        remark: { type: "string", description: "备注" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_channels",
    description: "查询渠道列表",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "按状态筛选" },
        rating: { type: "string", description: "按评级筛选" },
        is_public: { type: "number", description: "0=合作渠道，1=公域渠道" },
      },
    },
  },
  {
    name: "update_channel",
    description: "更新渠道信息",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "渠道ID（必填）" },
        name: { type: "string" }, contact_person: { type: "string" },
        wechat: { type: "string" }, phone: { type: "string" },
        company_type: { type: "string" }, company_name: { type: "string" },
        cooperation_mode: { type: "string" }, commission_rate: { type: "string" },
        settlement_method: { type: "string" }, status: { type: "string" },
        rating: { type: "string" }, total_customers: { type: "number" },
        total_revenue: { type: "number" }, main_products: { type: "string" },
        last_brought_customer_at: { type: "string" },
        is_public: { type: "number" }, account_name: { type: "string" },
        platform_id: { type: "string" }, followers: { type: "number" },
        remark: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_channel_stats",
    description: "获取渠道统计数据（总数、活跃数、总成交金额等）",
    inputSchema: { type: "object", properties: {} },
  },
  // --- CRM Composite Tools ---
  {
    name: "crm_get_client",
    description: "查客户：按姓名或ID查找客户完整信息（含跟进记录），用于通话中快速查阅客户档案",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "客户姓名或ID" },
      },
      required: ["name"],
    },
  },
  {
    name: "crm_add_client",
    description: "新客户：创建客户档案，如指定渠道则自动创建渠道引入记录，一次调用完成客户+渠道关联",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "姓名（必填）" },
        company: { type: "string", description: "公司" },
        role: { type: "string", description: "职位" },
        phone: { type: "string", description: "手机号" },
        email: { type: "string", description: "邮箱" },
        wechat: { type: "string", description: "微信号" },
        stage: { type: "string", description: "阶段" },
        source: { type: "string", description: "来源渠道" },
        level: { type: "string", description: "客户评级" },
        sales_person: { type: "string", description: "内部Sales" },
        project_type: { type: "string", description: "所属项目" },
        budget_range: { type: "string", description: "预算范围" },
        identity: { type: "string", description: "身份" },
        situation: { type: "string", description: "情况说明" },
        channel: { type: "string", description: "引入渠道名称或ID（可选，填写则自动关联）" },
      },
      required: ["name"],
    },
  },
  {
    name: "crm_add_followup",
    description: "记跟进：创建跟进记录 + 自动更新下次跟进日期 + 自动推进阶段（新线索→跟进中），一次调用同步全部下游",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "客户姓名或ID" },
        method: { type: "string", description: "跟进方式（微信/面谈/电话/群聊）" },
        content: { type: "string", description: "沟通内容" },
        next_step: { type: "string", description: "下一步计划/下次跟进日期" },
        date: { type: "string", description: "跟进日期 YYYY-MM-DD（默认今天）" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "crm_update_stage",
    description: "改阶段：更新客户阶段 + 自动返回最新漏斗统计，一次调用完成阶段变更+数据同步",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "客户姓名或ID" },
        stage: { type: "string", description: "目标阶段", enum: ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交", "已流失"] },
      },
      required: ["name", "stage"],
    },
  },
  {
    name: "crm_record_deal",
    description: "记成交：创建收入记录 + 自动更新客户阶段为已成交 + 自动累加商机金额，一次调用完成业绩登记",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "客户姓名或ID" },
        amount: { type: "number", description: "成交金额" },
        description: { type: "string", description: "交易描述" },
        product_type: { type: "string", description: "产品/项目类型" },
        payment_status: { type: "string", description: "回款状态", enum: ["已回款", "部分回款", "未回款"] },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "crm_list_overdue",
    description: "逾期跟进列表：获取今日到期及逾期的待跟进客户清单",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "crm_get_pipeline",
    description: "漏斗概览：返回销售漏斗各阶段人数 + 总客户/活跃客户/总商机/总收入/待跟进数",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "crm_search",
    description: "搜索客户：按姓名/公司/职位关键词搜索客户列表",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
  },
  // --- Content Pieces ---
  {
    name: "create_content_piece",
    description: "创建内容追踪记录（平台流量作品的元数据）",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "标题（必填）" },
        platform: { type: "string", description: "平台", enum: ["公众号", "小红书", "抖音", "视频号", "知识星球", "朋友圈"] },
        form: { type: "string", description: "形式", enum: ["文章", "图文", "口播稿", "Talk"] },
        status: { type: "string", description: "状态", enum: ["选题中", "草稿", "拍摄中", "待发布", "已发布", "关闭"] },
        published_at: { type: "string", description: "发布日期 YYYY-MM-DD" },
        topic_source: { type: "string", description: "选题来源" },
        doc_id: { type: "string", description: "关联知识库文档ID" },
        views: { type: "number", description: "阅读量/播放量" },
        likes: { type: "number", description: "点赞" },
        comments: { type: "number", description: "评论数" },
        shares: { type: "number", description: "转发/收藏" },
        tags: { type: "array", items: { type: "string" }, description: "标签" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_content_piece",
    description: "更新内容追踪记录（状态、数据回收等）",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "内容ID（必填）" },
        title: { type: "string" }, platform: { type: "string" },
        form: { type: "string" }, status: { type: "string" },
        published_at: { type: "string" }, topic_source: { type: "string" },
        doc_id: { type: "string" },
        views: { type: "number" }, likes: { type: "number" },
        comments: { type: "number" }, shares: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
    },
  },
  {
    name: "list_content_pieces",
    description: "查询内容追踪列表（可按平台/形式/状态筛选）",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "按平台筛选" },
        form: { type: "string", description: "按形式筛选" },
        status: { type: "string", description: "按状态筛选" },
        q: { type: "string", description: "搜索标题" },
      },
    },
  },
  {
    name: "get_content_piece",
    description: "获取单条内容追踪详情",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "内容ID" } },
      required: ["id"],
    },
  },
  {
    name: "delete_content_piece",
    description: "删除内容追踪记录",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "内容ID" } },
      required: ["id"],
    },
  },
  {
    name: "get_content_piece_stats",
    description: "获取内容统计数据（总数、按平台/状态/形式分布、阅读量）",
    inputSchema: { type: "object", properties: {} },
  },
  // --- Content Composite Tools ---
  {
    name: "content_publish",
    description: "发布内容：自动将状态改为已发布 + 自动填入今日发布日期 + 返回最新统计，一次完成发布+数据同步",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "内容标题或ID" },
      },
      required: ["name"],
    },
  },
  {
    name: "content_update_metrics",
    description: "更新内容数据：更新阅读量/点赞/评论/转发，自动返回最新统计",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "内容标题或ID" },
        views: { type: "number", description: "阅读量/播放量" },
        likes: { type: "number", description: "点赞" },
        comments: { type: "number", description: "评论数" },
        shares: { type: "number", description: "转发/收藏" },
      },
      required: ["name"],
    },
  },
  {
    name: "content_check_daily",
    description: "每日内容指标检查：检查今日各平台发布完成情况（公众号≥1、小红书≥1、知识星球≥1），返回完成度报告",
    inputSchema: { type: "object", properties: {} },
  },
  // --- Getbiji (Material Sync) ---
  {
    name: "getbiji_sync",
    description: "同步 Get 笔记素材到系统（占位，待接入）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getbiji_status",
    description: "查看 Get 笔记同步状态（占位，待接入）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getbiji_force_full",
    description: "强制全量同步 Get 笔记（占位，待接入）",
    inputSchema: { type: "object", properties: {} },
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
  // --- Schema Management ---
  {
    name: "list_fields",
    description: "列出指定实体（contacts/channels/transactions等）的所有字段定义，包括字段类型、选项、可见性等元数据",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "实体名称，如 contacts、channels、transactions", enum: ["contacts", "channels", "transactions"] },
      },
      required: ["entity"],
    },
  },
  {
    name: "add_field",
    description: "为指定实体动态添加一个新字段。添加后前端会自动显示该字段，无需修改前端代码。",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "实体名称，如 contacts、channels、transactions", enum: ["contacts", "channels", "transactions"] },
        field_key: { type: "string", description: "字段键名，英文小写+下划线，如 birthday、contract_no" },
        label: { type: "string", description: "字段显示名，如 '生日'、'合同编号'" },
        field_type: { type: "string", description: "字段类型", enum: ["text", "number", "select", "date", "checkbox", "currency", "textarea", "relation"] },
        options: { type: "string", description: "select类型的选项JSON，如 '[{\"value\":\"选项1\",\"label\":\"选项1\"},{\"value\":\"选项2\",\"label\":\"选项2\"}]'" },
        section: { type: "string", description: "详情页分组名，如 '联系方式'、'业务'、'财务'" },
        width: { type: "number", description: "列宽（像素），默认150" },
        render_hint: { type: "string", description: "渲染提示", enum: ["title", "badge", "currency", "kanban_lane"] },
        relation_entity: { type: "string", description: "relation类型字段关联的目标实体名" },
      },
      required: ["entity", "field_key", "label", "field_type"],
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

    // Follow-ups
    case "create_follow_up": return createFollowUp(args)
    case "list_follow_ups": return listFollowUps(args)
    case "update_follow_up": return updateFollowUp(args.id, args)
    case "get_follow_up_reminders": return getFollowUpReminders()

    // Channels
    case "create_channel": return createChannel(args)
    case "list_channels": return listChannels(args)
    case "update_channel": return updateChannel(args.id, args)
    case "get_channel_stats": return getChannelStats()

    // CRM Composite Tools
    case "crm_get_client": return crmGetClient(args.name)
    case "crm_add_client": return crmAddClient(args)
    case "crm_add_followup": return crmAddFollowup(args.name, args)
    case "crm_update_stage": return crmUpdateStage(args.name, args.stage)
    case "crm_record_deal": return crmRecordDeal(args.name, args)
    case "crm_list_overdue": return crmListOverdue()
    case "crm_get_pipeline": return crmGetPipeline()
    case "crm_search": return crmSearch(args.query)

    // Content Pieces
    case "create_content_piece": return createContentPiece(args)
    case "update_content_piece": return updateContentPiece(args.id, args)
    case "list_content_pieces": return listContentPieces(args)
    case "get_content_piece": return getContentPiece(args.id)
    case "delete_content_piece": return deleteContentPiece(args.id)
    case "get_content_piece_stats": return getContentPieceStats()

    // Content Composite
    case "content_publish": return contentPublish(args.name)
    case "content_update_metrics": return contentUpdateMetrics(args.name, args)
    case "content_check_daily": return contentCheckDaily()

    // Getbiji
    case "getbiji_sync": return getbijiSync()
    case "getbiji_status": return getbijiStatus()
    case "getbiji_force_full": return getbijiForceFull()

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

    // Schema Management
    case "list_fields": return listFieldDefinitions(args.entity)
    case "add_field": {
      const result = createFieldDefinition(args)
      if (!result) throw new Error(`字段 ${args.field_key} 已存在于 ${args.entity}`)
      return result
    }

    default: throw new Error(`Unknown tool: ${name}`)
  }
}

// ── JSON-RPC message handler ─────────────────────────────────

async function handleMessage(message: any): Promise<any> {
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
        const result = await executeTool(toolName, toolArgs)
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

export async function handleSSEMessage(body: any, sessionIdParam: string | null): Promise<any> {
  // For notifications (no id), return null (no response)
  if (!body.id && body.method === "notifications/initialized") {
    const session = sessionIdParam ? sessions.get(sessionIdParam) : null
    if (session) session.initialized = true
    return null
  }

  const response = await handleMessage(body)

  // Also send via SSE stream if session exists
  if (sessionIdParam && response) {
    const session = sessions.get(sessionIdParam)
    if (session) {
      sseSend(session.controller, response)
    }
  }

  return response
}
