// Seed mock data: 20 contacts, 20 transactions, 20 projects (with tasks & follow-ups)
// Run: bun run server/seed-mock.js

const BASE = 'http://localhost:3001/api/crazor'

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

async function patch(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

async function main() {
  console.log('🌱 Seeding mock data...\n')

  // ── 20 Contacts (source 必须是渠道管理里的真实渠道名) ────────
  const contacts = [
    { name: '张伟', company: '星辰科技有限公司', role: 'CEO', phone: '13800001001', wechat: 'zhangwei_star', stage: '已成交', source: '老王推荐', level: 'A', identity: '企业主', project_type: '建站', budget_range: '5-10万', sales_person: '李明', deal: 68000, remark: '老客户，已合作2年' },
    { name: '王芳', company: '云帆教育集团', role: '市场总监', phone: '13800001002', wechat: 'wangfang_edu', stage: '谈判中', source: '云帆教育集团', level: 'A', identity: '职场人', project_type: 'AI技术', budget_range: '10-20万', sales_person: '李明', remark: 'AI培训项目，对方案很感兴趣' },
    { name: '陈刚', company: '绿源环保科技', role: '技术负责人', phone: '13800001003', stage: '报价中', source: '小红书官方号', level: 'B', identity: '职场人', project_type: '技术服务', budget_range: '3-5万', sales_person: '赵婷', remark: '需要环境监测系统定制' },
    { name: '李娜', company: '锦鲤餐饮管理', role: '创始人', phone: '13800001004', wechat: 'lina_food', stage: '已成交', source: '李总朋友圈', level: 'A', identity: '企业主', project_type: 'APP&小程序', budget_range: '8-15万', sales_person: '李明', deal: 128000, remark: '餐饮小程序+外卖系统' },
    { name: '刘洋', company: '极光设计工作室', role: '设计总监', phone: '13800001005', wechat: 'liuyang_design', stage: '已成交', source: '陈姐推荐', level: '已合作', identity: '自由职业', project_type: '建站', budget_range: '2-5万', sales_person: '赵婷', deal: 35000, remark: '作品集网站，已交付' },
    { name: '赵敏', company: '恒达地产', role: '数字化经理', phone: '13800001006', stage: '意向确认', source: '抖音企业号', level: 'B', identity: '职场人', project_type: '技术服务', budget_range: '5-10万', sales_person: '王强', remark: 'VR看房系统需求' },
    { name: '孙鹏', company: '梦想传媒', role: '运营总监', phone: '13800001007', wechat: 'sunpeng_media', stage: '跟进中', source: '公众号主号', level: 'B', identity: '职场人', project_type: '课程', budget_range: '2-5万', sales_person: '赵婷', remark: '想了解短视频运营课程' },
    { name: '周婷', company: '美加国际贸易', role: 'CEO', phone: '13800001008', wechat: 'zhouting_trade', stage: '已成交', source: '李总朋友圈', level: '已合作', identity: '企业主', project_type: 'APP&小程序', budget_range: '15-30万', sales_person: '李明', deal: 235000, remark: '跨境电商APP，二期开发中' },
    { name: '吴磊', company: '智慧农场', role: '负责人', phone: '13800001009', stage: '新线索', source: '小红书官方号', level: 'C', identity: '企业主', project_type: 'AI技术', budget_range: '1-3万', sales_person: '王强', remark: '对AI农产品识别感兴趣' },
    { name: '郑雪', company: '朗读书院', role: '院长', phone: '13800001010', wechat: 'zhengxue_read', stage: '跟进中', source: '老赵渠道', level: 'B', identity: '企业主', project_type: '建站', budget_range: '3-5万', sales_person: '赵婷', remark: '在线教育平台需求' },
    { name: '黄海', company: '鼎盛物流', role: 'CTO', phone: '13800001011', wechat: 'huanghai_log', stage: '已流失', source: '鼎盛物流合作', level: 'D', identity: '职场人', project_type: '技术服务', budget_range: '5-10万', sales_person: '王强', remark: '预算未批，已搁置' },
    { name: '马丽', company: '花漾美容', role: '运营主管', phone: '13800001012', wechat: 'mali_beauty', stage: '报价中', source: '视频号', level: 'A', identity: '职场人', project_type: 'APP&小程序', budget_range: '5-8万', sales_person: '赵婷', remark: '预约小程序+会员系统' },
    { name: '林峰', company: '远见投资', role: '合伙人', phone: '13800001013', stage: '谈判中', source: '聚才培训', level: 'A', identity: '企业主', project_type: '企业培训', budget_range: '10-20万', sales_person: '李明', remark: 'AI赋能企业培训项目' },
    { name: '徐静', company: '童心教育', role: '校长', phone: '13800001014', wechat: 'xujing_edu', stage: '跟进中', source: '小红书官方号', level: 'C', identity: '企业主', project_type: '建站', budget_range: '1-3万', sales_person: '王强', remark: '少儿编程学校官网' },
    { name: '杨帆', company: '启航科技', role: '产品经理', phone: '13800001015', wechat: 'yangfan_tech', stage: '已成交', source: '启航科技', level: '已合作', identity: '职场人', project_type: 'AI技术', budget_range: '8-15万', sales_person: '李明', deal: 95000, remark: 'AI客服系统，年费合作' },
    { name: '何强', company: '丰收农业', role: '总经理', phone: '13800001016', stage: '新线索', source: '抖音企业号', level: 'C', identity: '企业主', project_type: '技术服务', budget_range: '3-5万', sales_person: '赵婷', remark: '农业数据管理系统' },
    { name: '谢琳', company: '潮牌服饰', role: '品牌经理', phone: '13800001017', wechat: 'xielin_fashion', stage: '意向确认', source: '创意工场MCN', level: 'B', identity: '职场人', project_type: 'APP&小程序', budget_range: '5-10万', sales_person: '王强', remark: '电商小程序+直播功能' },
    { name: '邓超', company: '安心保险', role: '数字化主管', phone: '13800001018', stage: '跟进中', source: '公众号主号', level: 'B', identity: '职场人', project_type: 'AI技术', budget_range: '10-20万', sales_person: '李明', remark: 'AI智能核保系统咨询' },
    { name: '曹颖', company: '优品家居', role: 'CEO', phone: '13800001019', wechat: 'caoying_home', stage: '已成交', source: '老王推荐', level: '已合作', identity: '企业主', project_type: '建站', budget_range: '3-5万', sales_person: '赵婷', deal: 42000, remark: '家居商城网站，长期合作' },
    { name: '韩冰', company: '新锐广告', role: '创意总监', phone: '13800001020', wechat: 'hanbing_ad', stage: '新线索', source: '知乎专栏', level: 'C', identity: '职场人', project_type: '课程', budget_range: '1-2万', sales_person: '王强', remark: 'AI设计工具培训需求' },
  ]

  const contactIds = []
  for (const c of contacts) {
    const r = await post('/contacts', c)
    contactIds.push(r.id)
    console.log(`  ✅ 联系人: ${c.name} (${c.company}) → ${r.id?.slice(0,8)}`)
  }

  // ── 20 Transactions ──────────────────────────────────────
  const transactions = [
    { idx: 0, type: 'income', amount: 68000, date: '2026-01-15', category: '服务', subcategory: '项目款', contact_id: 'ref:0', description: '星辰科技官网改版尾款', product_type: '建站', progress: '已完成', payment_status: '已回款', payment_channel: '银行转账' },
    { idx: 1, type: 'income', amount: 50000, date: '2026-02-20', category: '服务', subcategory: '项目款', contact_id: 'ref:1', description: '云帆教育AI培训首期款', product_type: 'AI技术', progress: '开发中', payment_status: '已回款', payment_channel: '银行转账' },
    { idx: 2, type: 'income', amount: 15000, date: '2026-03-05', category: '服务', subcategory: '咨询费', contact_id: 'ref:2', description: '绿源环保技术咨询费', product_type: '技术服务', progress: '进行中', payment_status: '已回款', payment_channel: '微信' },
    { idx: 3, type: 'income', amount: 64000, date: '2026-02-10', category: '产品', subcategory: '项目款', contact_id: 'ref:3', description: '锦鲤餐饮小程序首期款', product_type: 'APP&小程序', progress: '开发中', payment_status: '部分回款', payment_channel: '银行转账' },
    { idx: 4, type: 'income', amount: 35000, date: '2026-01-20', category: '服务', subcategory: '项目款', contact_id: 'ref:4', description: '极光设计作品集网站', product_type: '建站', progress: '已完成', payment_status: '已回款', payment_channel: '支付宝' },
    { idx: 5, type: 'income', amount: 120000, date: '2026-03-15', category: '产品', subcategory: '项目款', contact_id: 'ref:7', description: '恒达地产跨境APP二期款', product_type: 'APP&小程序', progress: '进行中', payment_status: '已回款', payment_channel: '银行转账' },
    { idx: 6, type: 'income', amount: 115000, date: '2026-01-10', category: '产品', subcategory: '项目款', contact_id: 'ref:7', description: '恒达地产跨境APP首期款', product_type: 'APP&小程序', progress: '已完成', payment_status: '已回款', payment_channel: '银行转账' },
    { idx: 7, type: 'income', amount: 47500, date: '2026-03-01', category: '服务', subcategory: '维护费', contact_id: 'ref:14', description: '启航科技AI客服年费Q1', product_type: 'AI技术', progress: '进行中', payment_status: '已回款', payment_channel: '银行转账' },
    { idx: 8, type: 'income', amount: 47500, date: '2026-01-01', category: '服务', subcategory: '维护费', contact_id: 'ref:14', description: '启航科技AI客服年费首付', product_type: 'AI技术', progress: '已完成', payment_status: '已回款', payment_channel: '银行转账' },
    { idx: 9, type: 'income', amount: 42000, date: '2026-02-28', category: '服务', subcategory: '项目款', contact_id: 'ref:18', description: '优品家居商城网站', product_type: '建站', progress: '已完成', payment_status: '已回款', payment_channel: '银行转账' },
    { idx: 10, type: 'expense', amount: 8000, date: '2026-01-05', category: '运营', subcategory: '租金', description: '1月办公室租金' },
    { idx: 11, type: 'expense', amount: 8000, date: '2026-02-05', category: '运营', subcategory: '租金', description: '2月办公室租金' },
    { idx: 12, type: 'expense', amount: 8000, date: '2026-03-05', category: '运营', subcategory: '租金', description: '3月办公室租金' },
    { idx: 13, type: 'expense', amount: 35000, date: '2026-01-25', category: '人力', subcategory: '工资', description: '1月工资支出' },
    { idx: 14, type: 'expense', amount: 35000, date: '2026-02-25', category: '人力', subcategory: '工资', description: '2月工资支出' },
    { idx: 15, type: 'expense', amount: 35000, date: '2026-03-25', category: '人力', subcategory: '工资', description: '3月工资支出' },
    { idx: 16, type: 'expense', amount: 5200, date: '2026-02-15', category: '市场', subcategory: '广告费', description: '小红书推广费' },
    { idx: 17, type: 'expense', amount: 3800, date: '2026-03-10', category: '市场', subcategory: '广告费', description: '抖音广告投放' },
    { idx: 18, type: 'expense', amount: 1500, date: '2026-01-18', category: '运营', subcategory: '软件', description: 'Figma + Cursor 年费' },
    { idx: 19, type: 'expense', amount: 2800, date: '2026-03-20', category: '差旅', subcategory: '交通', description: '客户拜访差旅费' },
  ]

  console.log('')
  for (const t of transactions) {
    const body = { ...t }
    delete body.idx
    if (body.contact_id?.startsWith('ref:')) {
      body.contact_id = contactIds[parseInt(body.contact_id.split(':')[1])]
    }
    const r = await post('/transactions', body)
    const label = body.type === 'income' ? '收入' : '支出'
    console.log(`  ✅ ${label}: ¥${body.amount} (${body.date}) ${body.description}`)
  }

  // ── 20 Projects ──────────────────────────────────────────
  const projects = [
    { idx: 0, name: '星辰科技官网改版', description: '公司官网全面改版升级', contact_id: 'ref:0', budget: 68000, team: '李明(项目经理), 张三(设计), 王五(开发)', start_date: '2025-11-01', deadline: '2026-01-31', status: '已完成' },
    { idx: 1, name: '云帆教育AI培训平台', description: 'AI技术企业培训课程平台开发', contact_id: 'ref:1', budget: 180000, team: '李明(项目经理), 赵六(开发)', start_date: '2026-02-01', deadline: '2026-06-30', status: '进行中' },
    { idx: 2, name: '绿源环保监测系统', description: '环境监测数据采集与分析系统', contact_id: 'ref:2', budget: 45000, team: '王强(开发)', start_date: '2026-03-10', deadline: '2026-05-30', status: '进行中' },
    { idx: 3, name: '锦鲤餐饮小程序', description: '餐饮点单+外卖+会员小程序', contact_id: 'ref:3', budget: 128000, team: '李明(项目经理), 赵六(开发), 小美(设计)', start_date: '2026-01-15', deadline: '2026-04-30', status: '进行中' },
    { idx: 4, name: '极光设计作品集网站', description: '设计师作品展示网站', contact_id: 'ref:4', budget: 35000, team: '张三(设计), 王五(开发)', start_date: '2025-12-01', deadline: '2026-01-20', status: '已完成' },
    { idx: 5, name: '恒达VR看房系统', description: 'VR全景看房+在线预约系统', contact_id: 'ref:5', budget: 85000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 6, name: '星辰科技官网SEO优化', description: '官网SEO优化和内容运营', contact_id: 'ref:0', budget: 12000, team: '小美(内容)', start_date: '2026-02-01', deadline: '2026-05-01', status: '进行中' },
    { idx: 7, name: '梦想传媒短视频课程', description: '短视频运营课程内容制作', contact_id: 'ref:6', budget: 25000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 8, name: '恒达跨境APP二期', description: '跨境电商APP功能扩展和优化', contact_id: 'ref:7', budget: 120000, team: '李明(项目经理), 赵六(开发), 王五(开发)', start_date: '2026-02-15', deadline: '2026-06-15', status: '进行中' },
    { idx: 9, name: '智慧农场AI识别', description: 'AI农产品品质识别系统', contact_id: 'ref:8', budget: 25000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 10, name: '朗读书院在线平台', description: '在线教育平台开发', contact_id: 'ref:9', budget: 42000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 11, name: '花漾美容预约小程序', description: '美容预约+会员管理小程序', contact_id: 'ref:11', budget: 68000, team: '赵六(开发), 小美(设计)', start_date: '2026-03-20', deadline: '2026-06-20', status: '进行中' },
    { idx: 12, name: '远见投资AI培训', description: 'AI赋能企业培训项目', contact_id: 'ref:12', budget: 150000, team: '李明(项目经理)', start_date: '2026-04-01', deadline: '2026-08-31', status: '规划中' },
    { idx: 13, name: '童心教育官网', description: '少儿编程学校官网建设', contact_id: 'ref:13', budget: 28000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 14, name: '启航AI客服系统', description: 'AI智能客服系统年费服务', contact_id: 'ref:14', budget: 95000, team: '王强(开发), 赵六(开发)', start_date: '2026-01-01', deadline: '2026-12-31', status: '进行中' },
    { idx: 15, name: '潮牌服饰电商小程序', description: '电商+直播小程序', contact_id: 'ref:16', budget: 78000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 16, name: '安心保险AI核保', description: 'AI智能核保系统', contact_id: 'ref:17', budget: 180000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 17, name: '优品家居商城网站', description: '家居在线商城网站开发', contact_id: 'ref:18', budget: 42000, team: '张三(设计), 王五(开发)', start_date: '2026-01-10', deadline: '2026-02-28', status: '已完成' },
    { idx: 18, name: '丰收农业数据管理', description: '农业数据采集管理系统', contact_id: 'ref:15', budget: 38000, team: '待定', start_date: '', deadline: '', status: '规划中' },
    { idx: 19, name: '新锐广告AI培训', description: 'AI设计工具培训课程', contact_id: 'ref:19', budget: 15000, team: '待定', start_date: '', deadline: '', status: '规划中' },
  ]

  console.log('')
  const projectIds = []
  for (const p of projects) {
    const body = { ...p }
    delete body.idx
    if (body.contact_id?.startsWith('ref:')) {
      body.contact_id = contactIds[parseInt(body.contact_id.split(':')[1])]
    }
    const r = await post('/projects', body)
    projectIds.push(r.id)
    console.log(`  ✅ 项目: ${p.name} (${p.status})`)
  }

  // ── Tasks for active projects ────────────────────────────
  console.log('')
  const taskSets = [
    // 项目1: 云帆教育AI培训平台
    { projectIdx: 1, tasks: [
      { title: '需求调研与确认', priority: 'high', assignee: '李明', status: 'done', due_date: '2026-02-15', estimated_hours: 16, actual_hours: 14 },
      { title: '平台架构设计', priority: 'high', assignee: '赵六', status: 'done', due_date: '2026-03-01', estimated_hours: 24, actual_hours: 22 },
      { title: '课程管理模块开发', priority: 'high', assignee: '赵六', status: 'doing', due_date: '2026-04-15', estimated_hours: 40 },
      { title: '用户管理模块开发', priority: 'medium', assignee: '赵六', status: 'todo', due_date: '2026-05-01', estimated_hours: 32 },
      { title: '视频播放功能集成', priority: 'medium', assignee: '赵六', status: 'todo', due_date: '2026-05-15', estimated_hours: 24 },
    ]},
    // 项目3: 锦鲤餐饮小程序
    { projectIdx: 3, tasks: [
      { title: 'UI设计稿', priority: 'high', assignee: '小美', status: 'done', due_date: '2026-02-01', estimated_hours: 32, actual_hours: 28 },
      { title: '点单模块开发', priority: 'high', assignee: '赵六', status: 'done', due_date: '2026-03-01', estimated_hours: 40, actual_hours: 38 },
      { title: '外卖模块开发', priority: 'high', assignee: '赵六', status: 'doing', due_date: '2026-04-01', estimated_hours: 36 },
      { title: '会员积分系统', priority: 'medium', assignee: '赵六', status: 'todo', due_date: '2026-04-15', estimated_hours: 24 },
      { title: '支付对接', priority: 'high', assignee: '王五', status: 'todo', due_date: '2026-04-20', estimated_hours: 16 },
    ]},
    // 项目8: 恒达跨境APP二期
    { projectIdx: 8, tasks: [
      { title: '二期需求评审', priority: 'high', assignee: '李明', status: 'done', due_date: '2026-02-28', estimated_hours: 8, actual_hours: 6 },
      { title: '多语言支持开发', priority: 'high', assignee: '赵六', status: 'doing', due_date: '2026-04-15', estimated_hours: 48 },
      { title: '支付网关升级', priority: 'high', assignee: '王五', status: 'doing', due_date: '2026-04-10', estimated_hours: 32 },
      { title: '物流追踪集成', priority: 'medium', assignee: '王五', status: 'todo', due_date: '2026-05-15', estimated_hours: 24 },
      { title: '性能优化', priority: 'medium', assignee: '赵六', status: 'todo', due_date: '2026-05-30', estimated_hours: 20 },
    ]},
    // 项目11: 花漾美容预约小程序
    { projectIdx: 11, tasks: [
      { title: '需求确认', priority: 'high', assignee: '赵婷', status: 'done', due_date: '2026-03-25', estimated_hours: 8, actual_hours: 6 },
      { title: 'UI设计', priority: 'high', assignee: '小美', status: 'doing', due_date: '2026-04-10', estimated_hours: 24 },
      { title: '预约模块开发', priority: 'high', assignee: '赵六', status: 'todo', due_date: '2026-05-01', estimated_hours: 32 },
      { title: '会员系统开发', priority: 'medium', assignee: '赵六', status: 'todo', due_date: '2026-05-20', estimated_hours: 24 },
    ]},
    // 项目14: 启航AI客服系统
    { projectIdx: 14, tasks: [
      { title: 'Q1系统维护', priority: 'medium', assignee: '王强', status: 'done', due_date: '2026-03-31', estimated_hours: 16, actual_hours: 12 },
      { title: 'Q2功能升级', priority: 'high', assignee: '赵六', status: 'doing', due_date: '2026-06-30', estimated_hours: 40 },
      { title: '知识库优化', priority: 'medium', assignee: '王强', status: 'doing', due_date: '2026-05-15', estimated_hours: 20 },
    ]},
  ]

  for (const set of taskSets) {
    const pid = projectIds[set.projectIdx]
    for (const t of set.tasks) {
      const r = await post('/tasks', { project_id: pid, ...t })
      // Move to correct status
      if (t.status === 'done') await patch(`/tasks/${r.id}/move`, { status: 'done' })
      else if (t.status === 'doing') await patch(`/tasks/${r.id}/move`, { status: 'doing' })
    }
    console.log(`  ✅ 任务: ${projects[set.projectIdx].name} → ${set.tasks.length}个任务`)
  }

  // ── Follow-ups ───────────────────────────────────────────
  console.log('')
  const followUps = [
    { contactIdx: 1, date: '2026-03-10', method: '面谈', content: '与王芳面谈AI培训方案，对方对课程内容很满意，要求增加实操环节', next_step: '3月25日前出修改版方案', status: '已完成' },
    { contactIdx: 1, date: '2026-03-25', method: '微信', content: '发送修改版方案，王芳正在内部审批中', next_step: '4月5日跟进审批结果', status: '已跟进' },
    { contactIdx: 2, date: '2026-03-12', method: '电话', content: '电话确认环保监测系统技术方案细节', next_step: '3月20日前发送正式报价', status: '已完成' },
    { contactIdx: 5, date: '2026-03-15', method: '微信', content: '赵敏询问VR看房方案价格和工期', next_step: '本周五前出详细报价', status: '已跟进' },
    { contactIdx: 6, date: '2026-03-18', method: '群聊', content: '梦想传媒社群内咨询短视频课程', next_step: '下周一发课程大纲', status: '待跟进' },
    { contactIdx: 11, date: '2026-03-20', method: '微信', content: '马丽确认小程序功能需求，要求加直播模块', next_step: '3月28日前出报价', status: '已跟进' },
    { contactIdx: 12, date: '2026-03-22', method: '面谈', content: '与林峰面谈AI培训合作，对方希望先做一期试讲', next_step: '4月5日安排试讲', status: '已跟进' },
    { contactIdx: 16, date: '2026-03-19', method: '微信', content: '谢琳询问电商小程序案例', next_step: '本周发送案例集', status: '待跟进' },
    { contactIdx: 17, date: '2026-03-21', method: '电话', content: '邓超咨询AI核保系统技术可行性', next_step: '4月1日出技术方案', status: '已跟进' },
    { contactIdx: 9, date: '2026-05-20', method: '微信', content: '计划跟进智慧农场AI识别需求', next_step: '了解预算和工期要求', status: '待跟进' },
  ]

  for (const f of followUps) {
    await post('/follow-ups', {
      contact_id: contactIds[f.contactIdx],
      date: f.date,
      method: f.method,
      content: f.content,
      next_step: f.next_step,
      status: f.status,
    })
  }
  console.log(`  ✅ 跟进记录: ${followUps.length}条`)

  // ── Channels ─────────────────────────────────────────────
  console.log('')
  const channels = [
    { name: '老王推荐', contact_person: '王建国', wechat: 'wangjianquo', phone: '13900001001', company_type: '个人', cooperation_mode: '返佣', commission_rate: '10%', settlement_method: '单次结算', status: '活跃', rating: '核心', main_products: '建站、技术服务' },
    { name: '李总朋友圈', contact_person: '李芳', wechat: 'lifang_ref', company_type: '个人', cooperation_mode: '一次性推荐', commission_rate: '5%', settlement_method: '单次结算', status: '活跃', rating: '核心', main_products: 'APP&小程序' },
    { name: '云帆教育集团', contact_person: '王芳', company_type: '公司', company_name: '云帆教育集团', cooperation_mode: '分成', commission_rate: '15%', settlement_method: '月结', status: '活跃', rating: '核心', main_products: 'AI技术、培训' },
    { name: '启航科技', contact_person: '杨帆', company_type: '公司', company_name: '启航科技', cooperation_mode: '代理', commission_rate: '20%', settlement_method: '季结', status: '活跃', rating: '一般', main_products: 'AI技术' },
    { name: '创意工场MCN', contact_person: '张小明', wechat: 'zhangxm_mcn', phone: '13900001005', company_type: 'MCN', company_name: '创意工场', cooperation_mode: '分成', commission_rate: '30%', settlement_method: '月结', status: '活跃', rating: '一般', main_products: '课程分销' },
    { name: '聚才培训', contact_person: '刘伟', phone: '13900001006', company_type: '培训机构', company_name: '聚才职业培训', cooperation_mode: '课程分销', commission_rate: '25%', settlement_method: '月结', status: '活跃', rating: '潜力', main_products: '企业培训、课程' },
    { name: '陈姐推荐', contact_person: '陈小红', wechat: 'chenxh_ref', company_type: '个人', cooperation_mode: '返佣', commission_rate: '8%', settlement_method: '单次结算', status: '休眠', rating: '一般', main_products: '建站' },
    { name: '老赵渠道', contact_person: '赵大明', phone: '13900001008', company_type: '个人', cooperation_mode: '互推', settlement_method: '单次结算', status: '休眠', rating: '潜力', main_products: '技术服务' },
    { name: '鼎盛物流合作', contact_person: '黄海', company_type: '公司', company_name: '鼎盛物流', cooperation_mode: '互推', status: '已终止', rating: '一般', main_products: '技术服务' },
    { name: '远见资本', contact_person: '林峰', company_type: '公司', company_name: '远见投资', cooperation_mode: '分成', commission_rate: '10%', settlement_method: '季结', status: '活跃', rating: '潜力', main_products: 'AI技术、企业培训' },
    { name: '小红书官方号', account_name: 'Crazor智能', platform_id: 'xhs_crazor', followers: 5200, is_public: 1, company_type: 'MCN', status: '活跃', rating: '核心' },
    { name: '公众号主号', account_name: 'Crazor', platform_id: 'gh_crazor', followers: 12500, is_public: 1, company_type: '公司', status: '活跃', rating: '核心' },
    { name: '抖音企业号', account_name: 'Crazor科技', platform_id: 'dy_crazor', followers: 8800, is_public: 1, company_type: '公司', status: '活跃', rating: '一般' },
    { name: '视频号', account_name: 'Crazor', platform_id: 'wx_crazor', followers: 3200, is_public: 1, company_type: '公司', status: '活跃', rating: '潜力' },
    { name: '知乎专栏', account_name: 'Crazor AI', platform_id: 'zh_crazor', followers: 1800, is_public: 1, company_type: '个人', status: '休眠', rating: '潜力' },
  ]

  const channelIds = []
  for (const ch of channels) {
    const r = await post('/channels', ch)
    channelIds.push(r.id)
    console.log(`  ✅ 渠道: ${ch.name} (${ch.is_public ? '公域' : ch.company_type})`)
  }

  // ── Channel Referrals (every contact linked to their source channel) ──
  // 渠道顺序: 0老王推荐 1李总朋友圈 2云帆教育集团 3启航科技 4创意工场MCN 5聚才培训 6陈姐推荐 7老赵渠道 8鼎盛物流合作 9远见资本 10小红书官方号 11公众号主号 12抖音企业号 13视频号 14知乎专栏
  const referrals = [
    { channelIdx: 0, contactIdx: 0, product_type: '建站', deal_amount: 68000, date: '2026-01-15' },     // 老王推荐 → 张伟
    { channelIdx: 0, contactIdx: 18, product_type: '建站', deal_amount: 42000, date: '2026-02-28' },    // 老王推荐 → 曹颖
    { channelIdx: 1, contactIdx: 3, product_type: 'APP&小程序', deal_amount: 128000, date: '2026-02-10' }, // 李总朋友圈 → 李娜
    { channelIdx: 1, contactIdx: 7, product_type: 'APP&小程序', deal_amount: 235000, date: '2026-01-10' }, // 李总朋友圈 → 周婷
    { channelIdx: 2, contactIdx: 1, product_type: 'AI技术', deal_amount: 50000, date: '2026-02-20' },   // 云帆教育 → 王芳
    { channelIdx: 3, contactIdx: 14, product_type: 'AI技术', deal_amount: 95000, date: '2026-01-01' },  // 启航科技 → 杨帆
    { channelIdx: 4, contactIdx: 16, product_type: 'APP&小程序', deal_amount: 0, date: '2026-03-15' },  // 创意工场MCN → 谢琳
    { channelIdx: 5, contactIdx: 12, product_type: '企业培训', deal_amount: 0, date: '2026-03-22' },    // 聚才培训 → 林峰
    { channelIdx: 6, contactIdx: 4, product_type: '建站', deal_amount: 35000, date: '2025-12-20' },     // 陈姐推荐 → 刘洋
    { channelIdx: 7, contactIdx: 9, product_type: '建站', deal_amount: 0, date: '2026-03-10' },         // 老赵渠道 → 郑雪
    { channelIdx: 8, contactIdx: 10, product_type: '技术服务', deal_amount: 0, date: '2026-02-01' },    // 鼎盛物流 → 黄海
    { channelIdx: 9, contactIdx: 16, product_type: 'APP&小程序', deal_amount: 0, date: '2026-02-15' },  // 远见资本 → 谢琳 (secondary)
    { channelIdx: 10, contactIdx: 2, product_type: '技术服务', deal_amount: 0, date: '2026-02-05' },    // 小红书官方号 → 陈刚
    { channelIdx: 10, contactIdx: 8, product_type: 'AI技术', deal_amount: 0, date: '2026-03-01' },      // 小红书官方号 → 吴磊
    { channelIdx: 10, contactIdx: 13, product_type: '建站', deal_amount: 0, date: '2026-03-05' },       // 小红书官方号 → 徐静
    { channelIdx: 11, contactIdx: 6, product_type: '课程', deal_amount: 0, date: '2026-02-10' },        // 公众号主号 → 孙鹏
    { channelIdx: 11, contactIdx: 17, product_type: 'AI技术', deal_amount: 0, date: '2026-02-15' },     // 公众号主号 → 邓超
    { channelIdx: 12, contactIdx: 5, product_type: '技术服务', deal_amount: 0, date: '2026-03-08' },    // 抖音企业号 → 赵敏
    { channelIdx: 12, contactIdx: 15, product_type: '技术服务', deal_amount: 0, date: '2026-03-12' },   // 抖音企业号 → 何强
    { channelIdx: 13, contactIdx: 11, product_type: 'APP&小程序', deal_amount: 0, date: '2026-03-01' }, // 视频号 → 马丽
    { channelIdx: 14, contactIdx: 19, product_type: '课程', deal_amount: 0, date: '2026-03-18' },       // 知乎专栏 → 韩冰
  ]

  for (const ref of referrals) {
    await post(`/channels/${channelIds[ref.channelIdx]}/referrals`, {
      contact_id: contactIds[ref.contactIdx],
      product_type: ref.product_type,
      deal_amount: ref.deal_amount,
      date: ref.date,
    })
  }
  console.log(`  ✅ 渠道关联: ${referrals.length}条`)

  // ── Summary ──────────────────────────────────────────────
  console.log('\n📊 数据汇总:')
  console.log(`  联系人: ${contactIds.length}个`)
  console.log(`  渠道: ${channelIds.length}个`)
  console.log(`  渠道关联: ${referrals.length}条`)
  console.log(`  交易记录: ${transactions.length}条`)
  console.log(`  项目: ${projectIds.length}个`)
  console.log(`  任务: ${taskSets.reduce((s, t) => s + t.tasks.length, 0)}个`)
  console.log(`  跟进记录: ${followUps.length}条`)
  console.log('\n✅ Mock 数据写入完成!')
}

main().catch(console.error)
