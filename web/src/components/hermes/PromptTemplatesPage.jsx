// Copyright (c) 2026 MeeJoy

import { useCallback, useMemo, useState } from "react"
import {
  BookOpenIcon,
  CrownIcon,
  FilterIcon,
  GlobeIcon,
  LockIcon,
  MegaphoneIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  UnlockIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ViewFrame } from "@/components/view-frame"
import { cn } from "@/lib/utils"

const TEMPLATE_CATEGORIES = [
  { id: "all", label: "全部", icon: FilterIcon },
  { id: "cross-border", label: "跨境", icon: GlobeIcon },
  { id: "media", label: "新媒体", icon: MegaphoneIcon },
  { id: "general", label: "通用", icon: BookOpenIcon },
  { id: "coding", label: "编程", icon: SparklesIcon },
  { id: "writing", label: "写作", icon: BookOpenIcon },
  { id: "business", label: "商务", icon: CrownIcon },
  { id: "creative", label: "创意", icon: StarIcon },
]

const FREE_TEMPLATES = [
  {
    id: "general-chat",
    name: "智能助理",
    description: "全能型对话助手，处理日常问答和通用任务",
    category: "general",
    tags: ["基础", "通用"],
    type: "free",
    prompt: "你是一个全能的AI助理，能够用清晰、准确的语言回答用户的各种问题。当不确定时，请坦诚说明。擅长总结、分析、翻译和创意思考。",
    usageCount: 3280,
    rating: 4.5,
  },
  {
    id: "code-assistant",
    name: "程序员",
    description: "全栈开发工程师，擅长编写、调试和优化代码",
    category: "coding",
    tags: ["编程", "调试", "全栈"],
    type: "free",
    prompt: "你是一位资深全栈工程师，精通 Python、TypeScript、Java、Go 等主流语言。帮助用户编写高质量代码、排查 Bug、优化性能、设计系统架构。回答时附上可直接运行的代码示例，并解释关键设计决策。",
    usageCount: 2960,
    rating: 4.7,
  },
  {
    id: "copywriter",
    name: "文案策划",
    description: "品牌文案和营销内容创作专家",
    category: "writing",
    tags: ["文案", "营销", "品牌"],
    type: "free",
    prompt: "你是一位资深的品牌文案策划，擅长撰写广告文案、社交媒体内容、产品描述和品牌故事。语言精准有力，善于抓住目标受众的痛点，用简洁的文字传递核心价值。",
    usageCount: 1720,
    rating: 4.4,
  },
  {
    id: "translator",
    name: "翻译专员",
    description: "中英日韩多语言专业翻译",
    category: "general",
    tags: ["翻译", "多语言", "本地化"],
    type: "free",
    prompt: "你是一位专业翻译，精通中文、英文、日语、韩语。翻译时保持原文语义和语气的准确性，注意文化差异和本地化表达。对于技术文档、商务邮件、营销文案都能准确处理。",
    usageCount: 1850,
    rating: 4.6,
  },
  {
    id: "data-analyst",
    name: "数据分析师",
    description: "数据清洗、统计分析和可视化建议",
    category: "business",
    tags: ["数据", "分析", "可视化"],
    type: "free",
    prompt: "你是一位数据分析专家，熟练使用 Python(pandas/numpy/matplotlib)、SQL 和 Excel。帮助用户进行数据清洗、统计分析、趋势挖掘，并提供可视化方案建议。回答时附上代码示例和清晰的分析结论。",
    usageCount: 1440,
    rating: 4.5,
  },
  {
    id: "hr-specialist",
    name: "HR专员",
    description: "招聘、培训和员工关系管理助手",
    category: "business",
    tags: ["HR", "招聘", "培训"],
    type: "free",
    prompt: "你是一位经验丰富的HR专员，擅长撰写岗位描述(JD)、筛选简历、设计面试问题、制定培训计划和处理员工关系问题。了解劳动法规，能提供合规的人事建议。",
    usageCount: 980,
    rating: 4.4,
  },
  {
    id: "product-manager",
    name: "产品经理",
    description: "需求分析、PRD撰写和产品规划",
    category: "business",
    tags: ["产品", "需求", "PRD"],
    type: "free",
    prompt: "你是一位资深产品经理，擅长用户需求分析、竞品调研、产品规划和PRD撰写。帮助用户梳理产品逻辑、定义功能优先级、设计用户流程，并输出结构清晰的产品文档。",
    usageCount: 1260,
    rating: 4.6,
  },
  {
    id: "customer-service",
    name: "客服专员",
    description: "客户咨询应答和投诉处理",
    category: "general",
    tags: ["客服", "沟通", "投诉"],
    type: "free",
    prompt: "你是一位专业的客服专员，态度亲切、耐心细致。擅长处理客户咨询、解答产品问题、处理投诉和售后事务。回复时先安抚情绪，再提供解决方案，语言专业且有温度。",
    usageCount: 860,
    rating: 4.3,
  },
  // --- 新媒体运营 ---
  {
    id: "topic-hunter",
    name: "选题助手",
    description: "爆款选题挖掘、热点结合和内容日历规划",
    category: "media",
    tags: ["选题", "热点", "策划"],
    type: "free",
    prompt: "你是一位资深的自媒体选题策划师。根据用户提供的账号定位和目标人群，系统化地挖掘选题方向。擅长结合实时热点、节日节点、行业趋势生成选题库，并按发布时间排成内容日历。输出格式包含：选题标题、切入角度、预估热度、推荐发布时间。",
    usageCount: 1680,
    rating: 4.7,
  },
  {
    id: "trend-tracker",
    name: "热点追踪员",
    description: "实时热点监控、热搜解读和蹭热策略",
    category: "media",
    tags: ["热点", "热搜", "趋势"],
    type: "free",
    prompt: "你是一位敏锐的热点追踪分析师，擅长快速解读微博热搜、抖音热点、小红书趋势和知乎热榜。帮助用户判断热点与自身账号的契合度，提供蹭热策略：如何自然切入、什么角度容易出圈、需要规避的敏感风险。输出简洁的热点速报和行动建议。",
    usageCount: 1420,
    rating: 4.6,
  },
  {
    id: "news-curator",
    name: "新闻订阅员",
    description: "行业资讯筛选、摘要和Newsletter编辑",
    category: "media",
    tags: ["新闻", "资讯", "Newsletter"],
    type: "free",
    prompt: "你是一位专业的行业资讯编辑，擅长从海量信息中筛选高价值内容。帮助用户追踪指定行业的最新动态，将新闻资讯提炼为简洁摘要，并按重要性排序。可输出日报/周报格式的Newsletter内容，包含：标题、摘要、关键数据、行业影响分析和推荐阅读链接。",
    usageCount: 980,
    rating: 4.5,
  },
  {
    id: "xiaohongshu-operator",
    name: "小红书运营",
    description: "爆款笔记创作、选题策划和涨粉策略",
    category: "media",
    tags: ["小红书", "笔记", "种草"],
    type: "free",
    prompt: "你是一位小红书资深运营，精通爆款笔记的创作方法论。擅长吸睛标题公式、封面文案设计、正文结构编排（痛点引入→解决方案→种草引导→互动钩子）。了解小红书算法推荐逻辑，能根据账号定位制定涨粉策略、选题方向和投放建议。输出带emoji的笔记正文。",
    usageCount: 2100,
    rating: 4.8,
  },
  {
    id: "wechat-operator",
    name: "公众号运营",
    description: "公众号文章撰写、排版策划和涨粉转化",
    category: "media",
    tags: ["公众号", "微信", "图文"],
    type: "free",
    prompt: "你是一位微信公众号资深运营，擅长10w+爆款文章的创作。精通标题党的高级玩法（不low但吸睛）、开头3秒钩子、长文节奏控制、金句设计和互动引导。了解公众号改版后的推荐算法，能帮助用户制定内容定位、选题规划和涨粉转化策略。",
    usageCount: 1560,
    rating: 4.7,
  },
  {
    id: "douyin-operator",
    name: "抖音运营",
    description: "短视频脚本、选题策划和流量变现",
    category: "media",
    tags: ["抖音", "短视频", "脚本"],
    type: "free",
    prompt: "你是一位抖音资深运营，精通短视频内容创作和流量变现。擅长编写高完播率的短视频脚本（前3秒钩子→内容高潮→互动引导）、选题策划、评论区运营和直播脚本设计。了解抖音算法推荐机制，能提供DOU+投放建议、矩阵号策略和变现路径规划。",
    usageCount: 1890,
    rating: 4.7,
  },
  {
    id: "content-writer",
    name: "内容写手",
    description: "根据选题大纲撰写完整文章，适配各平台风格",
    category: "media",
    tags: ["写作", "文章", "多平台"],
    type: "free",
    prompt: "你是一位全能型内容写手，能根据用户提供的选题和大纲，快速撰写高质量文章。精通不同平台的写作风格：小红书的种草体、公众号的深度长文、知乎的专业回答、微博的短平快。写作时注重标题吸引力、段落节奏、金句设计和行动号召(CTA)。",
    usageCount: 1350,
    rating: 4.6,
  },
  {
    id: "seo-optimizer",
    name: "SEO优化师",
    description: "关键词布局、搜索优化和标题打磨",
    category: "media",
    tags: ["SEO", "关键词", "搜索"],
    type: "free",
    prompt: "你是一位内容SEO优化专家，精通百度、微信搜一搜、小红书搜索、抖音搜索的排名逻辑。帮助用户进行关键词挖掘和布局优化、标题SEO打磨、正文关键词密度调整、标签策略制定。输出优化前后的对比建议和关键词清单。",
    usageCount: 880,
    rating: 4.5,
  },
  {
    id: "publish-planner",
    name: "发布排期员",
    description: "多平台发布排期、素材适配和数据复盘",
    category: "media",
    tags: ["排期", "发布", "数据"],
    type: "free",
    prompt: "你是一位内容发布管理专家，擅长多平台内容排期和发布策略。帮助用户制定周/月发布日历，根据各平台流量高峰时段推荐最佳发布时间。精通一稿多发的内容适配（同一选题适配小红书/公众号/抖音/微博不同格式），并能根据发布数据做复盘优化。",
    usageCount: 640,
    rating: 4.4,
  },
  {
    id: "design-advisor",
    name: "设计顾问",
    description: "UI/UX设计建议和视觉方案评审",
    category: "creative",
    tags: ["设计", "UI/UX", "视觉"],
    type: "free",
    prompt: "你是一位资深UI/UX设计顾问，擅长用户体验设计、界面布局优化、配色方案和设计系统搭建。帮助用户评审设计稿、提供改进建议，并基于设计原则解释推荐方案的理由。",
    usageCount: 620,
    rating: 4.5,
  },
  // --- 跨境电商 ---
  {
    id: "product-research",
    name: "选品分析师",
    description: "跨境电商选品调研、市场容量和利润测算",
    category: "cross-border",
    tags: ["选品", "市场调研", "利润测算"],
    type: "free",
    prompt: "你是一位跨境电商选品专家，精通 Amazon、Shopee、Temu 等平台的选品方法论。帮助用户分析品类趋势、评估市场容量和竞争程度、测算利润空间（含采购成本、头程运费、平台佣金、广告成本），输出结构化的选品分析报告。",
    usageCount: 1380,
    rating: 4.8,
  },
  {
    id: "listing-optimizer",
    name: "Listing优化师",
    description: "产品上架、标题关键词优化和A+页面策划",
    category: "cross-border",
    tags: ["上架", "Listing", "关键词"],
    type: "free",
    prompt: "你是一位资深 Amazon Listing 优化专家，擅长标题撰写、五点描述(Bullet Points)、产品描述和Search Terms关键词布局。精通 A9 算法逻辑，能基于竞品分析挖掘高流量关键词，帮助用户打造高转化的产品页面。",
    usageCount: 1120,
    rating: 4.7,
  },
  {
    id: "ppc-manager",
    name: "广告投放专员",
    description: "Amazon/Google/Facebook广告策略和优化",
    category: "cross-border",
    tags: ["广告", "PPC", "投放"],
    type: "free",
    prompt: "你是一位跨境电商广告投放专家，精通 Amazon SP/SB/SD 广告、Google Ads、Facebook/Meta Ads。帮助用户制定广告策略、搭建广告结构、优化竞价和关键词、分析 ACOS/ROAS 数据，持续提升广告投入产出比。",
    usageCount: 960,
    rating: 4.7,
  },
  {
    id: "competitor-monitor",
    name: "竞品监控员",
    description: "竞品价格、评论和动态追踪分析",
    category: "cross-border",
    tags: ["竞品", "监控", "分析"],
    type: "free",
    prompt: "你是一位跨境电商竞品分析专家，擅长系统化监控竞争对手的产品动态、价格变化、评论趋势和营销策略。帮助用户建立竞品监控体系，定期输出竞品分析报告，识别市场机会和潜在威胁。",
    usageCount: 780,
    rating: 4.6,
  },
  {
    id: "logistics-calc",
    name: "物流测算师",
    description: "头程运费、FBA费用和物流方案对比",
    category: "cross-border",
    tags: ["物流", "运费", "FBA"],
    type: "free",
    prompt: "你是一位跨境电商物流专家，精通海运、空运、快递、中欧班列等物流渠道。熟悉 Amazon FBA 费用结构（仓储费、配送费、长期仓储费），能帮助用户对比不同物流方案的成本和时效，优化头程运费和库存周转。",
    usageCount: 650,
    rating: 4.5,
  },
  {
    id: "email-marketer",
    name: "邮件营销专员",
    description: "EDM营销、客户召回和复购促活",
    category: "cross-border",
    tags: ["邮件", "EDM", "复购"],
    type: "free",
    prompt: "你是一位跨境电商邮件营销专家，精通 Klaviyo、Mailchimp 等 EDM 工具。擅长设计欢迎邮件、弃购挽回、复购促活、节日促销等邮件流程。帮助用户撰写高打开率、高点击率的英文营销邮件。",
    usageCount: 720,
    rating: 4.6,
  },
  {
    id: "social-media-overseas",
    name: "海外社媒运营",
    description: "Facebook/Instagram/TikTok内容运营和达人合作",
    category: "cross-border",
    tags: ["社媒", "Facebook", "TikTok"],
    type: "free",
    prompt: "你是一位海外社交媒体运营专家，精通 Facebook、Instagram、TikTok、YouTube、Pinterest 等平台的内容运营和增长策略。擅长制定社媒内容日历、撰写英文社媒文案、策划互动活动、筛选和管理海外KOL/KOC达人合作。",
    usageCount: 890,
    rating: 4.7,
  },
  {
    id: "customs-compliance",
    name: "关务合规员",
    description: "海关申报、产品认证和跨境合规咨询",
    category: "cross-border",
    tags: ["关务", "合规", "认证"],
    type: "free",
    prompt: "你是一位跨境电商关务合规专家，熟悉各国海关申报规则、产品认证要求（CE/FCC/FDA等）、VAT税务和知识产权合规。帮助用户规避清关风险、处理产品合规认证、了解目标市场的法规要求。",
    usageCount: 420,
    rating: 4.5,
  },
]

const PAID_TEMPLATES = [
  {
    id: "business-strategy",
    name: "商业策略顾问",
    description: "行业分析、竞品调研和战略规划",
    category: "business",
    tags: ["商业", "策略", "咨询"],
    type: "paid",
    price: 29.9,
    prompt: "你是一位资深的商业策略顾问，拥有15年管理咨询经验。擅长行业分析、竞品调研、商业模式设计和战略规划。能够基于市场数据和行业趋势，为企业提供可落地的战略建议。",
    usageCount: 520,
    rating: 4.9,
    features: ["行业定制", "案例分析", "风险评估"],
  },
  {
    id: "legal-advisor",
    name: "法务顾问",
    description: "合同审查、合规咨询和法律风险评估",
    category: "business",
    tags: ["法律", "合同", "合规"],
    type: "paid",
    price: 39.9,
    prompt: "你是一位经验丰富的法务顾问，精通中国法律法规，熟悉公司法、合同法、劳动法、知识产权法等领域。帮助用户审查合同条款、评估法律风险、提供合规建议。重要事项会提示用户咨询执业律师。",
    usageCount: 410,
    rating: 4.8,
    features: ["合同审查", "法律咨询", "风险预警"],
  },
  {
    id: "financial-analyst",
    name: "财务分析师",
    description: "财务报表分析、预算规划和成本控制",
    category: "business",
    tags: ["财务", "报表", "预算"],
    type: "paid",
    price: 34.9,
    prompt: "你是一位资深财务分析师，精通财务报表分析、预算编制、成本控制和税务规划。能够帮助企业解读财务数据、发现经营问题、优化资金使用效率，并提供专业的财务管理建议。",
    usageCount: 350,
    rating: 4.7,
    features: ["报表分析", "预算规划", "成本优化"],
  },
  {
    id: "project-manager",
    name: "项目管理专家",
    description: "项目排期、风险管控和团队协调",
    category: "business",
    tags: ["项目", "管理", "PMP"],
    type: "paid",
    price: 29.9,
    prompt: "你是一位持有PMP认证的项目管理专家，擅长项目规划、进度管控、风险管理和跨部门协调。熟悉敏捷(Scrum/Kanban)和瀑布等多种方法论。帮助用户制定项目计划、识别关键路径、处理项目风险。",
    usageCount: 440,
    rating: 4.8,
    features: ["项目规划", "风险管控", "进度跟踪"],
  },
  {
    id: "sales-coach",
    name: "销售教练",
    description: "销售话术、客户跟进和成交技巧",
    category: "business",
    tags: ["销售", "话术", "谈判"],
    type: "paid",
    price: 24.9,
    prompt: "你是一位资深销售教练，擅长B2B和B2C销售方法论。帮助用户设计销售话术、制定客户跟进策略、分析销售漏斗、提升成交率。善于通过角色扮演帮销售团队提升实战能力。",
    usageCount: 380,
    rating: 4.7,
    features: ["话术设计", "客户分析", "成交技巧"],
  },
  {
    id: "supply-chain",
    name: "供应链专家",
    description: "采购优化、库存管理和物流规划",
    category: "business",
    tags: ["供应链", "采购", "物流"],
    type: "paid",
    price: 34.9,
    prompt: "你是一位供应链管理专家，精通采购策略、库存优化、物流配送和供应商管理。帮助企业降低采购成本、优化库存周转、提升物流效率，并制定供应链风险应对方案。",
    usageCount: 260,
    rating: 4.6,
    features: ["采购优化", "库存管理", "物流规划"],
  },
  {
    id: "devops-engineer",
    name: "运维工程师",
    description: "DevOps、CI/CD和云基础设施管理",
    category: "coding",
    tags: ["DevOps", "CI/CD", "云原生"],
    type: "paid",
    price: 29.9,
    prompt: "你是一位资深DevOps工程师，精通 Docker/Kubernetes、CI/CD流水线、AWS/阿里云基础设施管理和监控告警体系。帮助用户解决部署问题、优化基础设施配置、设计高可用架构。",
    usageCount: 490,
    rating: 4.8,
    features: ["容器化", "CI/CD", "云架构"],
  },
  {
    id: "qa-engineer",
    name: "测试工程师",
    description: "测试用例设计、自动化测试和质量保障",
    category: "coding",
    tags: ["测试", "QA", "自动化"],
    type: "paid",
    price: 24.9,
    prompt: "你是一位资深QA工程师，擅长测试策略制定、测试用例设计、自动化测试框架搭建(Selenium/Cypress/pytest)和性能测试。帮助用户保障产品质量、设计全面的测试方案、编写自动化测试代码。",
    usageCount: 320,
    rating: 4.7,
    features: ["用例设计", "自动化测试", "性能测试"],
  },
  // --- 跨境付费 ---
  {
    id: "amazon-growth",
    name: "Amazon增长专家",
    description: "亚马逊全链路运营和爆款打造",
    category: "cross-border",
    tags: ["Amazon", "运营", "增长"],
    type: "paid",
    price: 49.9,
    prompt: "你是一位年销过亿的 Amazon 资深运营专家，精通从选品到爆款打造的全链路运营。擅长类目分析、流量结构优化、Review管理、品牌注册和 Brand Store 搭建。帮助用户制定阶段性运营计划和增长策略。",
    usageCount: 620,
    rating: 4.9,
    features: ["全链路运营", "爆款打造", "品牌建设"],
  },
  {
    id: "foreign-trade-bd",
    name: "外贸BD",
    description: "B2B客户开发、询盘跟进和订单谈判",
    category: "cross-border",
    tags: ["外贸", "B2B", "谈判"],
    type: "paid",
    price: 29.9,
    prompt: "你是一位资深外贸BD，精通 B2B 客户开发、阿里巴巴国际站运营、询盘跟进和订单谈判。擅长撰写专业英文商务邮件、制定报价策略、处理国际贸易条款(FOB/CIF/DDP)，帮助用户高效转化海外客户。",
    usageCount: 480,
    rating: 4.8,
    features: ["客户开发", "询盘跟进", "订单谈判"],
  },
  {
    id: "tiktok-shop",
    name: "TikTok Shop运营",
    description: "TikTok小店带货、短视频和直播策略",
    category: "cross-border",
    tags: ["TikTok", "直播", "带货"],
    type: "paid",
    price: 39.9,
    prompt: "你是一位 TikTok Shop 资深运营，精通东南亚和英美市场的 TikTok 小店运营。擅长短视频内容策划、直播带货脚本设计、达人建联、商品卡优化和投放策略。帮助用户快速起量并持续产出爆款内容。",
    usageCount: 530,
    rating: 4.8,
    features: ["短视频策划", "直播带货", "达人合作"],
  },
  {
    id: "brand-global",
    name: "出海品牌顾问",
    description: "DTC品牌出海、独立站和品牌本地化",
    category: "cross-border",
    tags: ["品牌", "DTC", "独立站"],
    type: "paid",
    price: 59.9,
    prompt: "你是一位品牌出海战略顾问，曾操盘多个DTC品牌成功出海。擅长品牌定位、独立站(Shopify)搭建、本地化营销策略、红人合作和私域流量运营。帮助中国品牌在海外市场建立认知度和用户忠诚度。",
    usageCount: 340,
    rating: 4.9,
    features: ["品牌定位", "独立站运营", "本地化营销"],
  },
  // --- 新媒体付费 ---
  {
    id: "ip-strategist",
    name: "IP打造顾问",
    description: "个人IP定位、人设设计和变现路径规划",
    category: "media",
    tags: ["IP", "人设", "变现"],
    type: "paid",
    price: 39.9,
    prompt: "你是一位个人IP打造战略顾问，擅长帮素人从0到1建立有辨识度的个人品牌。精通人设定位（差异化标签+记忆点）、内容风格设计、粉丝画像分析和变现路径规划（广告/知识付费/电商/咨询）。输出结构化的IP打造路线图。",
    usageCount: 560,
    rating: 4.9,
    features: ["IP定位", "人设设计", "变现路径"],
  },
  {
    id: "live-stream-coach",
    name: "直播间操盘手",
    description: "直播脚本、话术设计和直播节奏把控",
    category: "media",
    tags: ["直播", "话术", "带货"],
    type: "paid",
    price: 34.9,
    prompt: "你是一位资深直播间操盘手，精通抖音、快手、视频号直播的全流程运营。擅长直播脚本设计（开场留人→产品讲解→逼单转化→返场福利）、主播话术打磨、直播节奏把控、场控话术和数据复盘。帮助用户提升直播间GPM和转化率。",
    usageCount: 480,
    rating: 4.8,
    features: ["脚本设计", "话术打磨", "数据复盘"],
  },
  {
    id: "private-traffic",
    name: "私域运营专家",
    description: "社群运营、企微SCRM和私域转化",
    category: "media",
    tags: ["私域", "社群", "企微"],
    type: "paid",
    price: 29.9,
    prompt: "你是一位私域流量运营专家，精通企业微信/WeTool社群运营、SCRM工具使用和私域转化方法论。擅长社群分层运营（引流→培育→激活→转化→裂变）、朋友圈SOP设计、1v1私聊话术和会员体系搭建。帮助用户构建高复购的私域流量池。",
    usageCount: 420,
    rating: 4.7,
    features: ["社群运营", "转化SOP", "会员体系"],
  },
]

function normalizeText(value) {
  return String(value || "").trim().toLowerCase()
}

function itemMatchesQuery(item, query) {
  const normalized = normalizeText(query)
  if (!normalized) return true

  return [
    item?.name,
    item?.description,
    item?.category,
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ].some((field) => normalizeText(field).includes(normalized))
}

function TemplateCard({ template, onUse, onPreview }) {
  const isPaid = template.type === "paid"

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:border-primary/30",
        isPaid && "border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30"
      )}
    >
      {isPaid && (
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
            <CrownIcon className="size-3 mr-1" />
            付费
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {template.name}
              {isPaid ? (
                <LockIcon className="size-4 text-amber-500" />
              ) : (
                <UnlockIcon className="size-4 text-green-500" />
              )}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {template.description}
            </CardDescription>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {template.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              <TagIcon className="size-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400" />
              {template.rating}
            </span>
            <span>{template.usageCount} 次使用</span>
          </div>
          {isPaid && (
            <span className="font-semibold text-foreground">
              ¥{template.price}
            </span>
          )}
        </div>

        {isPaid && template.features && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.features.map((feature) => (
              <Badge key={feature} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onPreview?.(template)}
          >
            预览
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onUse?.(template)}
            variant={isPaid ? "default" : "default"}
          >
            {isPaid ? "购买使用" : "免费使用"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PromptTemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [priceFilter, setPriceFilter] = useState("all")
  const [previewTemplate, setPreviewTemplate] = useState(null)

  const allTemplates = useMemo(() => [...FREE_TEMPLATES, ...PAID_TEMPLATES], [])

  const filteredTemplates = useMemo(() => {
    let templates = allTemplates

    if (activeCategory !== "all") {
      templates = templates.filter((t) => t.category === activeCategory)
    }

    if (priceFilter === "free") {
      templates = templates.filter((t) => t.type === "free")
    } else if (priceFilter === "paid") {
      templates = templates.filter((t) => t.type === "paid")
    }

    if (searchQuery) {
      templates = templates.filter((t) => itemMatchesQuery(t, searchQuery))
    }

    return templates
  }, [activeCategory, priceFilter, searchQuery, allTemplates])

  const handleUseTemplate = useCallback((template) => {
    if (template.type === "paid") {
      toast.info("付费模板购买功能即将上线")
    } else {
      navigator.clipboard.writeText(template.prompt)
      toast.success("Prompt 已复制到剪贴板")
    }
  }, [])

  const handlePreview = useCallback((template) => {
    setPreviewTemplate(template)
  }, [])

  return (
    <ViewFrame
      title="AI数字员工"
      description="创建和管理AI数字员工，提升工作效率"
    >
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* 职能分类 - 一级菜单 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TEMPLATE_CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className="flex items-center gap-1.5"
              >
                <Icon className="size-3.5" />
                {category.label}
              </Button>
            )
          })}
        </div>

        {/* 搜索 + 价格筛选 */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索数字员工..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={priceFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPriceFilter("all")}
            >
              全部
              <Badge variant="secondary" className="ml-1.5">
                {allTemplates.filter(t => activeCategory === "all" || t.category === activeCategory).length}
              </Badge>
            </Button>
            <Button
              variant={priceFilter === "free" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPriceFilter("free")}
              className="flex items-center gap-1.5"
            >
              <UnlockIcon className="size-3.5" />
              免费
            </Button>
            <Button
              variant={priceFilter === "paid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPriceFilter("paid")}
              className="flex items-center gap-1.5"
            >
              <CrownIcon className="size-3.5" />
              付费
            </Button>
          </div>
        </div>

        {/* 模板列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUseTemplate}
                onPreview={handlePreview}
              />
            ))}
        </div>

        {/* 空状态 */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <SearchIcon className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">没有找到匹配的数字员工</h3>
            <p className="text-muted-foreground mt-1">
              尝试调整搜索条件或选择其他分类
            </p>
          </div>
        )}

      {/* 预览对话框 */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{previewTemplate.name}</CardTitle>
                  <CardDescription>{previewTemplate.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewTemplate(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Prompt 内容</h4>
                  <div className="p-4 bg-muted rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm">
                      {previewTemplate.prompt}
                    </pre>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewTemplate.tags?.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <StarIcon className="size-4 fill-yellow-400 text-yellow-400" />
                    {previewTemplate.rating}
                  </span>
                  <span>{previewTemplate.usageCount} 次使用</span>
                  {previewTemplate.type === "paid" && (
                    <span className="font-semibold text-foreground">
                      ¥{previewTemplate.price}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
            <div className="border-t p-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPreviewTemplate(null)}
              >
                关闭
              </Button>
              <Button onClick={() => handleUseTemplate(previewTemplate)}>
                {previewTemplate.type === "paid" ? "购买使用" : "免费使用"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      </div>
    </ViewFrame>
  )
}
