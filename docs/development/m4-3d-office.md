# M4 事件驱动 3D 数字员工办公室（炫酷版）

> 分支：`feature/m4-3d-office` · 2026-06-11
> 目标：把 2.5D 像素风「AI 数字员工办公室」从静态 three.js 场景升级为
> **事件驱动的纯 Canvas 2D 霓虹等距场景**，消费 M1 事件总线
> （`docs/development/m1-event-bus.md`）的真实事件流。动效技法全部移植自
> 已验证的原型 `crazor-3d-office-demo.html`，**零新增 npm 依赖**。

## 改动总览

| 文件 | 内容 |
|------|------|
| `web/src/components/office/OfficeView.jsx` | 入口壳保留（开关、ViewFrame、工具栏、侧边详情卡的契约不变）；内部改为创建 `OfficeEngine`，接入 `useCrazorEvents`，新增事件 ticker 滚动条、事件日志、在岗/在线/事件/交付统计 HUD |
| `web/src/components/office/engine2d/OfficeEngine.js` | 新建。主引擎：等距投影、平滑相机（跟拍/拖拽/缩放）、A* 走位、会议编排、事件→动画状态机、待机小动作、断线置灰 |
| `web/src/components/office/engine2d/sprites.js` | 新建。绘制器：地砖、霓虹墙体、工位桌（屏幕微光）、植物、沙发、前台、全息会议桌、像素角色（状态光环/思考粒子环/工具全息图标/打字火花/气泡）、名牌防重叠 pass |
| `web/src/components/office/engine2d/effects.js` | 新建。粒子系统：消息贝塞尔飞行+拖尾+到达涟漪、完成彩带、产物飞向右上角 HUD |
| `web/src/components/office/engine2d/iso.js` | 新建。等距投影 / lerp / clamp / shade / roundRect 等共享工具 |
| `web/src/components/office/data/eventRouting.js` | 新建。事件路由表：entity → 数字员工、MCP tool → 数字员工、实体中文标签、工具图标、`describeEvent`（ticker/日志文案） |
| `web/src/components/office/data/officeLayout.js` | 追加 `DEPT_ZONES`（14 个部门区域色光矩形）、`ENTRANCE`（真人入场门）、`HUMAN_SEATS`（开放区热座） |
| `web/src/components/office/store.js` | 追加 `delivered`（交付计数）、`agentStatus`（实时状态供详情卡显示）；zoom 下限放宽到 0.35（大地图自适应） |
| `web/src/components/office/ui/OfficeToolbar.jsx` | 开会/总结/散会流程与按钮文案不变，底层改为调用 `engine.startMeeting()/endMeeting()/zoomBy()/resetView()` |
| `web/src/components/office/ui/EmployeePanel.jsx` | 新增「实时状态」行（💤/🧠/⚙️/🚶/🪑 + 当前任务）；选中即跟拍；关闭即取消跟拍 |
| 删除 | `engine/Scene.js`、`engine/OfficeBuilder.js`、`engine/CharacterManager.js`、`engine/InputHandler.js`（three.js 渲染层）、`ui/EmployeeBubble.jsx`（DOM 名牌，改为 canvas 名牌+防重叠） |
| 保留复用 | `engine/Pathfinding.js`（A*）、`data/officeLayout.js` 网格、`data/employeeMap.js` 21 名员工工位映射 |

`three` 仍留在 package.json（未新增/未删除依赖），3D 办公室不再 import 它。

## 事件映射实现表（M1 协议 → 动画）

| 事件 | 实现 |
|------|------|
| `presence.online` | `syncOnline()` 快照对比 → 真人头像（白条纹制服+成员色）从前台门口入场，A* 走到开放区热座，气泡「🟢 上线」。hello 帧的 online 快照同样生效，**在线成员常驻办公室** |
| `presence.offline` | 头像气泡「🌙 先下线了」，走回门口后移除 |
| `member.joined` | 立即生成新成员头像 + 入场彩带 + 气泡「👋 大家好！」+ ticker 欢迎横幅 |
| `mcp.tool_called` | `TOOL_EMPLOYEE[data.tool]` 路由到对应数字员工：思考粒子环（45%）→ 敲键盘+工具全息图标（55%）；若 actor 是在线真人，先有一颗消息粒子从真人贝塞尔飞向员工 |
| `entity.created` | 同上完整序列 + 「✅ 完成！」+ 彩带 + 产物（如「任务 · 新建」）飞向右上角，交付计数 +1；`entity=transaction` 额外在大厅放彩带（收款庆祝） |
| `entity.updated` | 短工作脉冲（1.6s 思考→执行） |
| `entity.deleted` | 红色涟漪 + 体表闪光 + 气泡「🗑 删除了xx」 |
| `connected=false` | 场景压暗 + 顶部「🔌 事件流重连中…」呼吸提示；HUD 红点；重连后 hook 的 hello 回放自动补帧 |
| 所有事件 | 顶部 ticker 滚动条 + 右侧事件日志（最近 6 条，`describeEvent` 中文文案）+ 事件计数 |

路由兜底：未命中映射表的事件挑一名空闲员工执行；未在 `employeeMap` 的新技能自动在开放办公区热座落位。

## 与旧版的功能对照（不回归）

| 旧版（three.js） | 新版（canvas 2D） |
|------|------|
| 开关持久化（localStorage）+ 关闭态页面 | 不变 |
| `/api/crazor/skills/catalog` 拉取员工 | 不变 |
| 点击员工 → 高亮 + 侧边详情卡（meta/开始对话） | 点击 → 相机跟拍 + 名牌高亮 + 详情卡（新增实时状态行） |
| OrbitControls 缩放/平移 | 滚轮缩放 + 拖拽平移 + 平滑相机 + 重置视角 |
| 开会/总结/散会（4s 状态机 + onMeeting 日报）| 流程与文案完全一致；新增围坐发言气泡、会议全息投影、散会彩带 |
| DOM 名牌（EmployeeBubble） | canvas 名牌 + 防重叠上移 |
| 待机上下浮动 | 浮动 + 随机气泡 + 屏幕微光 + 植物摇摆（办公室永远是活的） |
| 无事件消费 | M1 全事件驱动（上表） |

`web/src/office-meeting-runtime.test.js` 两条用例验证通过（onMeeting 契约保持）。

## 验证清单

```bash
# 1. 源码不变量（已在本分支跑过，2 pass）
node --test web/src/office-meeting-runtime.test.js

# 2. 纯 JS 语法（已全部通过 node --check）
#    engine2d/*.js data/eventRouting.js data/officeLayout.js store.js

# 3. 联调（需 node_modules / registry 环境）
cd server && bun run dev          # 启动事件总线
cd web && npm run dev             # 打开 3D 办公室视图并开启
#   - 顶部绿点「事件流已连接」，ticker 显示最新事件
#   - curl -X POST http://localhost:3001/api/crazor/tasks -d '{"title":"x","project_id":"..."}'
#     → 项目助理：思考环 → 敲键盘+📋 → ✅ 彩带 → 「任务 · 新建」飞向右上角，交付 +1
#   - 第二个浏览器登录 → presence.online → 真人头像入场走到开放区
#   - 关闭 server → 场景压暗「重连中」；重启 → 自动恢复
#   - 滚轮缩放 / 拖拽平移 / 点击员工跟拍+详情卡 / 点空白取消
#   - 工具栏「开会」→ 全员走向会议室围坐 + 全息投影 + 轮流发言；「总结」→ 散会 + 触发日报
```

## 已知边界与后续

- 事件不含 payload 明细，产物标签用实体中文名（「任务 · 新建」级别粒度）；需要更精确文案时按 `entity_id` 回查。
- `mcp.tool_called` 的 actor 是 agent token 对应成员，无法精确指认是哪位「数字员工」执行，按工具名路由（`TOOL_EMPLOYEE`）近似。
- 真人热座按在线顺序循环分配，重复上线/下线极端情况下可能同座（名牌防重叠仍可读）。
- 触屏仅支持单指拖拽/点击（pointer events），未做双指捏合缩放。
- `node_modules` 不在环境内，本分支未跑 vite build；JSX 文件经人工审查 + 源码不变量测试。
