// M4 3D office: event-driven isometric canvas-2d engine.
// Zero new dependencies — pure Canvas 2D + requestAnimationFrame, with the
// neon/particle techniques ported from crazor-3d-office-demo.html:
// iso projection, shadowBlur glow, bezier message particles, thinking rings,
// tool holograms, confetti, A*-based walking, meeting hologram, smooth
// camera follow and vignette.

import { GRID, GRID_W, GRID_H, DEPT_ZONES, ENTRANCE, HUMAN_SEATS } from "../data/officeLayout"
import { getEmployeeVisual, MEETING_SEATS, COLOR_PALETTE } from "../data/employeeMap"
import { Pathfinder } from "../engine/Pathfinding"
import { iso, lerp, clamp, hashPhase } from "./iso"
import { Effects } from "./effects"
import {
  drawFloorTile,
  drawWall,
  drawDesk,
  drawPlant,
  drawSofa,
  drawReception,
  drawMeetingTable,
  drawAgent,
  drawNameplates,
} from "./sprites"
import { routeEmployee, iconFor, ENTITY_LABELS, describeEvent } from "../data/eventRouting"

const ZOOM_MIN = 0.35
const ZOOM_MAX = 2.5
const WALK_SPEED = 0.0042 // grid cells per ms

const IDLE_LINES = ["☕ 续杯咖啡", "📚 学习新技能", "🧹 整理工作区", "💡 有个新点子", "👀 盯一下数据"]
const MEETING_LINES = [
  "我的渠道数据显示增长 ↑",
  "建议主推家居品类",
  "物流成本可再降 12%",
  "达人投放 ROI 1:4.2",
  "竞品上周降价了",
  "内容矩阵已就绪",
  "本周线索转化率 18%",
  "新品素材已经备好",
]

function hashIndex(str = "", mod = 1) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) >>> 0
  return mod > 0 ? h % mod : 0
}

export class OfficeEngine {
  constructor(container, store, { onTicker } = {}) {
    this.container = container
    this.store = store
    this.onTicker = onTicker || null

    this.canvas = document.createElement("canvas")
    this.canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none"
    container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext("2d")
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)

    this.w = 0
    this.h = 0
    this.t = 0
    this.cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1, follow: null }
    this.home = { x: 0, y: 0, z: 1 }
    this.homeReady = false

    this.agents = new Map() // digital employees, keyed by skill id
    this.humans = new Map() // online members, keyed by member_id
    this.deskOwner = new Map() // "row,col" -> agent
    this.effects = new Effects()
    this.effects.onDeliver = () => this.store.getState().addDelivered()
    this.pathfinder = new Pathfinder(GRID)

    this.meeting = false
    this.meetingTopic = ""
    this.connected = true
    this.hoveredId = null
    this.drag = null
    this.timers = new Set()
    this.idleAcc = 0
    this.talkAcc = 0
    this.disposed = false

    this._buildStatic()
    this._bindInput()

    this._resizeObs = new ResizeObserver(() => this.resize())
    this._resizeObs.observe(container)
    this.resize()

    this._last = performance.now()
    this._frame = this._frame.bind(this)
    this._raf = requestAnimationFrame(this._frame)
  }

  /* ── scene graph (static furniture, precomputed once) ───────────── */

  _buildStatic() {
    this.floors = []
    this.statics = [] // depth-sorted occluders: { d, kind, gx, gy }
    this.deskCells = []
    let meetSumX = 0
    let meetSumY = 0
    let meetCount = 0
    const commonCells = []
    const receptionCells = []

    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const cell = GRID[r][c]
        if (cell === 1) {
          this.statics.push({ d: c + r, kind: "wall", gx: c, gy: r })
          continue
        }
        const even = (r + c) % 2 === 0
        let fill = even ? "rgba(120,110,255,.085)" : "rgba(120,110,255,.05)"
        if (cell === 3) fill = even ? "rgba(77,163,255,.12)" : "rgba(77,163,255,.08)"
        if (cell === 4) fill = even ? "rgba(255,107,203,.10)" : "rgba(255,107,203,.06)"
        if (cell === 5) fill = "rgba(0,212,200,.12)"
        if (cell === 6) fill = even ? "rgba(255,176,32,.10)" : "rgba(255,176,32,.06)"
        this.floors.push({ gx: c, gy: r, fill })

        if (cell === 2) {
          this.deskCells.push({ row: r, col: c })
          this.statics.push({ d: c + r, kind: "desk", gx: c, gy: r })
        }
        if (cell === 7) this.statics.push({ d: c + r, kind: "plant", gx: c, gy: r })
        if (cell === 3) {
          meetSumX += c
          meetSumY += r
          meetCount++
        }
        if (cell === 4) commonCells.push({ r, c })
        if (cell === 6) receptionCells.push({ r, c })
      }
    }

    this.meetCenter = meetCount
      ? { gx: meetSumX / meetCount + 0.5, gy: meetSumY / meetCount + 0.5 }
      : { gx: GRID_W / 2, gy: GRID_H / 2 }
    this.statics.push({
      d: this.meetCenter.gx + this.meetCenter.gy - 1.5,
      kind: "meeting-table",
      gx: this.meetCenter.gx,
      gy: this.meetCenter.gy,
    })
    if (commonCells.length) {
      const mid = commonCells[Math.floor(commonCells.length / 2)]
      this.statics.push({ d: mid.c + mid.r, kind: "sofa", gx: mid.c, gy: mid.r })
    }
    if (receptionCells.length) {
      const mid = receptionCells[Math.floor(receptionCells.length / 2)]
      this.statics.push({ d: mid.c + mid.r, kind: "reception", gx: mid.c, gy: mid.r })
    }
  }

  /* ── population ─────────────────────────────────────────────────── */

  setEmployees(employees) {
    const seen = new Set()
    let fallbackSeat = 0
    for (const emp of employees) {
      if (emp.id === "vault-rules") continue
      seen.add(emp.id)
      if (this.agents.has(emp.id)) {
        this.agents.get(emp.id).name = emp.name
        continue
      }
      let visual = getEmployeeVisual(emp.id)
      if (!visual) {
        // unmapped skills hot-desk in the open office area
        const seat = HUMAN_SEATS[(fallbackSeat++ + 6) % HUMAN_SEATS.length]
        visual = {
          color: COLOR_PALETTE[hashIndex(emp.id, COLOR_PALETTE.length)],
          gridRow: seat.row - 1,
          gridCol: seat.col,
          dept: "开放办公区",
          accessory: null,
        }
      }
      const home = { row: visual.gridRow + 1, col: visual.gridCol }
      const agent = {
        id: emp.id,
        kind: "agent",
        name: emp.name || emp.id,
        dept: visual.dept,
        color: visual.color,
        desk: { row: visual.gridRow, col: visual.gridCol },
        home,
        gx: home.col,
        gy: home.row,
        path: [],
        onArrive: null,
        state: "idle",
        task: "—",
        tool: null,
        bubble: null,
        flash: 0,
        bob: hashPhase(emp.id),
        seq: 0,
      }
      this.agents.set(emp.id, agent)
      this.deskOwner.set(`${visual.gridRow},${visual.gridCol}`, agent)
      this._status(agent)
    }
    for (const [id, agent] of this.agents) {
      if (!seen.has(id)) {
        this.deskOwner.delete(`${agent.desk.row},${agent.desk.col}`)
        this.agents.delete(id)
      }
    }
  }

  // presence snapshot → human avatars walk in / out
  syncOnline(online = []) {
    const ids = new Set()
    for (const m of online) {
      const id = m.member_id || "anonymous"
      ids.add(id)
      if (this.humans.has(id)) {
        const hu = this.humans.get(id)
        if (hu.leaving) {
          hu.leaving = false
          this._walkHumanToSeat(hu)
        }
        continue
      }
      this._spawnHuman(id, m.name || "成员", { welcome: false })
    }
    for (const [id, hu] of this.humans) {
      if (!ids.has(id) && !hu.leaving) this._removeHuman(hu)
    }
  }

  _spawnHuman(id, name, { welcome }) {
    const seat = HUMAN_SEATS[this.humans.size % HUMAN_SEATS.length]
    const human = {
      id,
      kind: "human",
      name,
      dept: "真人成员",
      color: COLOR_PALETTE[hashIndex(id, COLOR_PALETTE.length)],
      desk: null,
      home: { row: seat.row, col: seat.col },
      gx: ENTRANCE.col,
      gy: ENTRANCE.row,
      path: [],
      onArrive: null,
      state: "idle",
      task: "在线",
      tool: null,
      bubble: null,
      flash: 0,
      bob: hashPhase(id),
      seq: 0,
      leaving: false,
    }
    this.humans.set(id, human)
    if (welcome) {
      this.effects.confetti(human.gx, human.gy)
      this._say(human, "👋 大家好！")
    } else {
      this._say(human, "🟢 上线")
    }
    this._walkHumanToSeat(human)
    return human
  }

  _walkHumanToSeat(human) {
    this._walkTo(human, human.home.row, human.home.col, () => {
      human.state = "idle"
    })
  }

  _removeHuman(human) {
    human.leaving = true
    this._say(human, "🌙 先下线了")
    this._walkTo(human, ENTRANCE.row, ENTRANCE.col, () => {
      this.humans.delete(human.id)
    })
  }

  /* ── event-bus → animation mapping (docs/development/m1-event-bus.md) ── */

  handleEvent(event) {
    if (!event || this.disposed) return
    switch (event.type) {
      case "presence.online":
      case "presence.offline":
        // snapshot in event.data.online is authoritative; the hook also
        // pushes it via syncOnline, this keeps standalone consumers working
        if (Array.isArray(event.data?.online)) this.syncOnline(event.data.online)
        break
      case "member.joined": {
        const id = event.entity_id || event.actor_id
        if (id && !this.humans.has(id)) {
          this._spawnHuman(id, event.actor_name || "新成员", { welcome: true })
        }
        this.onTicker?.(describeEvent(event))
        break
      }
      case "mcp.tool_called": {
        const tool = event.data?.tool || "tool"
        this._workSequence(routeEmployee(event), {
          task: tool,
          icon: iconFor(tool),
          actorId: event.actor_id,
          duration: 2600,
        })
        break
      }
      case "entity.created": {
        const label = ENTITY_LABELS[event.entity] || event.entity || "产物"
        this._workSequence(routeEmployee(event), {
          task: `创建${label}`,
          icon: iconFor(event.entity || ""),
          actorId: event.actor_id,
          duration: 3000,
          artifact: `${label} · 新建`,
          celebrate: event.entity === "transaction",
        })
        break
      }
      case "entity.updated": {
        const label = ENTITY_LABELS[event.entity] || event.entity || "数据"
        this._workSequence(routeEmployee(event), {
          task: `更新${label}`,
          icon: iconFor(event.entity || ""),
          actorId: event.actor_id,
          duration: 1600,
        })
        break
      }
      case "entity.deleted": {
        const agent = this._pickAgent(routeEmployee(event))
        if (agent) {
          const label = ENTITY_LABELS[event.entity] || event.entity || "数据"
          this._say(agent, `🗑 删除了${label}`)
          agent.flash = 1
          const p = iso(agent.gx, agent.gy)
          this.effects.ripple(p.x, p.y, "#ff4d6b")
        }
        break
      }
      default:
        break
    }
  }

  _pickAgent(preferredId) {
    if (preferredId && this.agents.has(preferredId)) return this.agents.get(preferredId)
    const idle = [...this.agents.values()].filter((a) => a.state === "idle")
    const pool = idle.length ? idle : [...this.agents.values()]
    return pool.length ? pool[(Math.random() * pool.length) | 0] : null
  }

  // think → work(tool hologram) → done(confetti + artifact fly-out)
  _workSequence(employeeId, { task, icon, actorId, duration = 2600, artifact = null, celebrate = false }) {
    const agent = this._pickAgent(employeeId)
    if (!agent) return
    // a message particle flies from the human actor to the employee
    if (actorId && this.humans.has(actorId)) {
      this.effects.sendMsg(this.humans.get(actorId), agent, this.humans.get(actorId).color)
    }
    if (agent.state === "meeting" || agent.state === "walking") {
      agent.flash = 1
      this._say(agent, `📌 收到：${task}`)
      return
    }
    const seq = ++agent.seq
    agent.state = "thinking"
    agent.task = task
    this._say(agent, `🤔 ${task}`)
    this._status(agent)
    this._later(() => {
      if (agent.seq !== seq) return
      agent.state = "working"
      agent.tool = icon || "⚙️"
      this._status(agent)
    }, duration * 0.45)
    this._later(() => {
      if (agent.seq !== seq) return
      agent.state = "idle"
      agent.tool = null
      agent.task = "—"
      if (artifact) {
        this._say(agent, "✅ 完成！")
        this.effects.confetti(agent.gx, agent.gy)
        this.effects.artifact(agent.gx, agent.gy, artifact)
        this.onTicker?.(`✨ ${agent.name} 交付：${artifact}`)
      }
      if (celebrate) {
        this.effects.confetti(this.meetCenter.gx, this.meetCenter.gy)
        this.onTicker?.("🎉 新的收款入账！")
      }
      this._status(agent)
    }, duration)
  }

  /* ── meeting choreography ───────────────────────────────────────── */

  startMeeting(topic) {
    if (this.meeting) return
    this.meeting = true
    this.meetingTopic = topic || "📊 全员会议进行中"
    this.onTicker?.("🪑 全员会议开始，员工正走向会议室")
    let i = 0
    for (const agent of this.agents.values()) {
      if (i >= MEETING_SEATS.length) break
      const seat = MEETING_SEATS[i++]
      agent.seat = seat
      this._later(() => {
        if (!this.meeting) return
        this._walkTo(agent, seat.row, seat.col, () => {
          agent.state = "meeting"
          agent.task = "会议中"
          this._status(agent)
        })
      }, i * 160)
    }
  }

  endMeeting() {
    if (!this.meeting) return
    this.meeting = false
    this.effects.confetti(this.meetCenter.gx, this.meetCenter.gy)
    this.onTicker?.("📋 会议结束，纪要生成中，员工返回工位")
    let i = 0
    for (const agent of this.agents.values()) {
      agent.seat = null
      this._later(() => {
        this._walkTo(agent, agent.home.row, agent.home.col, () => {
          agent.state = "idle"
          agent.task = "—"
          this._status(agent)
        })
      }, i++ * 140)
    }
  }

  /* ── camera / viewport ──────────────────────────────────────────── */

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.w = w
    this.h = h
    this.canvas.width = w * this.dpr
    this.canvas.height = h * this.dpr
    if (!this.homeReady) {
      const center = iso(GRID_W / 2, GRID_H / 2)
      const mapW = ((GRID_W + GRID_H) / 2) * 48
      const mapH = ((GRID_W + GRID_H) / 2) * 24 + 80
      const fit = clamp(Math.min(w / mapW, h / mapH) * 0.95, ZOOM_MIN, ZOOM_MAX)
      this.home = { x: center.x, y: center.y, z: fit }
      this.cam.x = this.cam.tx = center.x
      this.cam.y = this.cam.ty = center.y
      this.cam.z = this.cam.tz = fit
      this.homeReady = true
      this.store.getState().setZoom(fit)
    }
  }

  setZoom(z) {
    this.cam.tz = clamp(z, ZOOM_MIN, ZOOM_MAX)
  }

  zoomBy(factor) {
    this.setZoom(this.cam.tz * factor)
    this.store.getState().setZoom(this.cam.tz)
  }

  resetView() {
    this.cam.follow = null
    this.cam.tx = this.home.x
    this.cam.ty = this.home.y
    this.cam.tz = this.home.z
    this.store.getState().setZoom(this.home.z)
  }

  focusEmployee(id) {
    const target = this.agents.get(id) || this.humans.get(id)
    if (!target) return
    this.cam.follow = target
  }

  unfollow() {
    this.cam.follow = null
  }

  setConnected(connected) {
    this.connected = !!connected
  }

  /* ── input: drag pan, wheel zoom, click pick + follow ───────────── */

  _bindInput() {
    this._onDown = (e) => {
      this.drag = { x: e.clientX, y: e.clientY, cx: this.cam.tx, cy: this.cam.ty, moved: false }
      this.canvas.style.cursor = "grabbing"
    }
    this._onMove = (e) => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x
        const dy = e.clientY - this.drag.y
        if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true
        if (this.drag.moved) {
          this.cam.follow = null
          this.cam.tx = this.drag.cx - dx / this.cam.z
          this.cam.ty = this.drag.cy - dy / this.cam.z
        }
        return
      }
      const hit = this._pick(e)
      const hovered = hit && hit.kind === "agent" ? hit.id : null
      if (hovered !== this.hoveredId) {
        this.hoveredId = hovered
        this.store.getState().setHoveredEmployee(hovered)
      }
      this.canvas.style.cursor = hit ? "pointer" : "grab"
    }
    this._onUp = (e) => {
      this.canvas.style.cursor = "grab"
      if (this.drag && !this.drag.moved) {
        const hit = this._pick(e)
        if (hit) {
          this.cam.follow = hit
          this.cam.tz = Math.max(this.cam.tz, 1.3)
          this.store.getState().setZoom(this.cam.tz)
          this.store.getState().selectEmployee(hit.kind === "agent" ? hit.id : null)
        } else {
          this.cam.follow = null
          this.store.getState().selectEmployee(null)
        }
      }
      this.drag = null
    }
    this._onWheel = (e) => {
      e.preventDefault()
      this.cam.tz = clamp(this.cam.tz * (e.deltaY > 0 ? 0.9 : 1.12), ZOOM_MIN, ZOOM_MAX)
      this.store.getState().setZoom(this.cam.tz)
    }
    this.canvas.addEventListener("pointerdown", this._onDown)
    window.addEventListener("pointermove", this._onMove)
    window.addEventListener("pointerup", this._onUp)
    this.canvas.addEventListener("wheel", this._onWheel, { passive: false })
  }

  _pick(e) {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let best = null
    let bd = Infinity
    const check = (a) => {
      const s = this._project(iso(a.gx, a.gy))
      const d = Math.hypot(s.x - mx, s.y - (my + 24 * this.cam.z))
      if (d < 40 * this.cam.z && d < bd) {
        bd = d
        best = a
      }
    }
    for (const a of this.agents.values()) check(a)
    for (const hu of this.humans.values()) check(hu)
    return best
  }

  /* ── helpers ────────────────────────────────────────────────────── */

  _project(p) {
    return {
      x: (p.x - this.cam.x) * this.cam.z + this.w / 2,
      y: (p.y - this.cam.y) * this.cam.z + this.h / 2,
    }
  }

  _sg(gx, gy) {
    return this._project(iso(gx, gy))
  }

  _say(actor, text, dur) {
    actor.bubble = { text, start: this.t, dur: dur || 2600 }
  }

  _status(agent) {
    this.store.getState().setAgentStatus(agent.id, { state: agent.state, task: agent.task })
  }

  _walkTo(actor, row, col, onArrive) {
    const path = this.pathfinder.findPath(
      Math.round(actor.gy),
      Math.round(actor.gx),
      row,
      col,
    )
    if (!path.length) {
      actor.gx = col
      actor.gy = row
      onArrive?.()
      return
    }
    actor.path = path
    actor.onArrive = onArrive || null
    actor.state = "walking"
    if (actor.kind === "agent") this._status(actor)
  }

  _later(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id)
      if (!this.disposed) fn()
    }, ms)
    this.timers.add(id)
    return id
  }

  /* ── main loop ──────────────────────────────────────────────────── */

  _frame() {
    if (this.disposed) return
    this._raf = requestAnimationFrame(this._frame)
    const nowTs = performance.now()
    const dt = Math.min(50, nowTs - this._last)
    this._last = nowTs
    this.t += dt

    this._update(dt)
    this._render()
  }

  _update(dt) {
    const cam = this.cam
    if (cam.follow) {
      const p = iso(cam.follow.gx, cam.follow.gy)
      cam.tx = p.x
      cam.ty = p.y - 20
    }
    cam.x = lerp(cam.x, cam.tx, 0.06)
    cam.y = lerp(cam.y, cam.ty, 0.06)
    cam.z = lerp(cam.z, cam.tz, 0.08)

    // walking along A* paths
    const step = WALK_SPEED * dt
    const move = (a) => {
      if (!a.path.length) return
      const target = a.path[0]
      const dx = target.col - a.gx
      const dy = target.row - a.gy
      const d = Math.hypot(dx, dy)
      if (d < step) {
        a.gx = target.col
        a.gy = target.row
        a.path.shift()
        if (!a.path.length) {
          const cb = a.onArrive
          a.onArrive = null
          a.state = "idle"
          cb?.()
        }
      } else {
        a.gx += (dx / d) * step
        a.gy += (dy / d) * step
      }
    }
    for (const a of this.agents.values()) move(a)
    for (const hu of this.humans.values()) move(hu)

    this.effects.update(dt)

    // meeting chatter
    if (this.meeting) {
      this.talkAcc += dt
      if (this.talkAcc > 1500) {
        this.talkAcc = 0
        const speakers = [...this.agents.values()].filter((a) => a.state === "meeting")
        if (speakers.length) {
          const a = speakers[(Math.random() * speakers.length) | 0]
          this._say(a, MEETING_LINES[(Math.random() * MEETING_LINES.length) | 0], 2200)
        }
      }
    }

    // idle chatter — the office is always alive
    this.idleAcc += dt
    if (this.idleAcc > 4200) {
      this.idleAcc = 0
      if (!this.meeting && Math.random() < 0.6) {
        const idles = [...this.agents.values()].filter((a) => a.state === "idle")
        if (idles.length) {
          const a = idles[(Math.random() * idles.length) | 0]
          this._say(a, IDLE_LINES[(Math.random() * IDLE_LINES.length) | 0], 2000)
        }
      }
    }
  }

  _render() {
    const ctx = this.ctx
    const z = this.cam.z
    const t = this.t
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    // deep-space background
    const bg = ctx.createRadialGradient(
      this.w / 2, this.h / 2, 100,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.8,
    )
    bg.addColorStop(0, "#11132a")
    bg.addColorStop(1, "#07070f")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, this.w, this.h)

    // floor
    for (const f of this.floors) {
      drawFloorTile(ctx, this._sg(f.gx + 0.5, f.gy + 0.5), z, f.fill)
    }

    // department zone glow + labels
    for (const zone of DEPT_ZONES) {
      const corners = [
        this._sg(zone.x0, zone.y0),
        this._sg(zone.x1, zone.y0),
        this._sg(zone.x1, zone.y1),
        this._sg(zone.x0, zone.y1),
      ]
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y)
      ctx.closePath()
      ctx.fillStyle = zone.c + "14"
      ctx.fill()
      ctx.strokeStyle = zone.c + "66"
      ctx.lineWidth = 1.5
      ctx.shadowColor = zone.c
      ctx.shadowBlur = 12
      ctx.stroke()
      ctx.shadowBlur = 0
      const lp = this._sg(zone.x0 + 0.4, zone.y0 + 0.6)
      ctx.font = `${10 * Math.min(z, 1.3)}px sans-serif`
      ctx.textAlign = "left"
      ctx.fillStyle = zone.c + "cc"
      ctx.fillText(zone.label, lp.x, lp.y)
    }

    // depth-sorted occluders: furniture + walls + characters
    const queue = []
    for (const s of this.statics) queue.push(s)
    for (const a of this.agents.values()) queue.push({ d: a.gx + a.gy, kind: "actor", actor: a })
    for (const hu of this.humans.values()) queue.push({ d: hu.gx + hu.gy, kind: "actor", actor: hu })
    queue.sort((q1, q2) => q1.d - q2.d)

    const plates = []
    const selectedId = this.store.getState().selectedEmployeeId
    for (const q of queue) {
      switch (q.kind) {
        case "wall":
          drawWall(ctx, this._sg(q.gx + 0.5, q.gy + 0.5), z)
          break
        case "desk": {
          const owner = this.deskOwner.get(`${q.gy},${q.gx}`)
          drawDesk(
            ctx,
            this._sg(q.gx + 0.5, q.gy + 0.5),
            z,
            owner?.color,
            !!owner && owner.state !== "idle",
            t,
            owner?.bob || 0,
          )
          break
        }
        case "plant":
          drawPlant(ctx, this._sg(q.gx + 0.5, q.gy + 0.7), z, t)
          break
        case "sofa":
          drawSofa(ctx, this._sg(q.gx + 0.5, q.gy + 0.5), z)
          break
        case "reception":
          drawReception(ctx, this._sg(q.gx + 0.5, q.gy + 0.5), z, t)
          break
        case "meeting-table":
          drawMeetingTable(ctx, this._sg(q.gx, q.gy), z, t, this.meeting, this.meetingTopic)
          break
        case "actor": {
          const a = q.actor
          const followed = this.cam.follow === a || selectedId === a.id
          plates.push(drawAgent(ctx, this._sg(a.gx, a.gy), z, a, t, followed))
          break
        }
        default:
          break
      }
    }

    // particles above the scene
    this.effects.drawWorld(ctx, (p) => this._project(p), z)
    // nameplates last (anti-overlap pass)
    drawNameplates(ctx, plates)
    this.effects.drawArtifacts(ctx, (p) => this._project(p), this.w)

    // vignette
    const vg = ctx.createRadialGradient(
      this.w / 2, this.h / 2, this.h * 0.35,
      this.w / 2, this.h / 2, this.h * 0.95,
    )
    vg.addColorStop(0, "rgba(0,0,0,0)")
    vg.addColorStop(1, "rgba(0,0,0,.5)")
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, this.w, this.h)

    // event stream lost — dim the office until the socket recovers
    if (!this.connected) {
      ctx.fillStyle = "rgba(10,10,20,.45)"
      ctx.fillRect(0, 0, this.w, this.h)
      ctx.font = "13px sans-serif"
      ctx.textAlign = "center"
      ctx.fillStyle = "#8b90b8"
      const pulse = 0.6 + Math.sin(t / 350) * 0.3
      ctx.globalAlpha = pulse
      ctx.fillText("🔌 事件流重连中…", this.w / 2, 28)
      ctx.globalAlpha = 1
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this._raf)
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
    this._resizeObs?.disconnect()
    this.canvas.removeEventListener("pointerdown", this._onDown)
    window.removeEventListener("pointermove", this._onMove)
    window.removeEventListener("pointerup", this._onUp)
    this.canvas.removeEventListener("wheel", this._onWheel)
    this.canvas.remove()
    this.effects.clear()
    this.agents.clear()
    this.humans.clear()
  }
}
