// M4 3D office: canvas-2d sprite painters (tiles, walls, furniture, agents)
// Neon glow via shadowBlur, pixel-lite shapes — ported from the demo prototype.

import { TW, TH, rr, shade } from "./iso"

// flat diamond tile at screen point p (tile center)
export function tilePath(ctx, p, z) {
  const hw = (TW / 2) * z
  const hh = (TH / 2) * z
  ctx.beginPath()
  ctx.moveTo(p.x, p.y - hh)
  ctx.lineTo(p.x + hw, p.y)
  ctx.lineTo(p.x, p.y + hh)
  ctx.lineTo(p.x - hw, p.y)
  ctx.closePath()
}

export function drawFloorTile(ctx, p, z, fill) {
  tilePath(ctx, p, z)
  ctx.fillStyle = fill
  ctx.fill()
}

// extruded wall prism (top diamond + two visible faces)
export function drawWall(ctx, p, z) {
  const hw = (TW / 2) * z
  const hh = (TH / 2) * z
  const h = 26 * z
  // west face
  ctx.fillStyle = "#15172e"
  ctx.beginPath()
  ctx.moveTo(p.x - hw, p.y)
  ctx.lineTo(p.x, p.y + hh)
  ctx.lineTo(p.x, p.y + hh - h)
  ctx.lineTo(p.x - hw, p.y - h)
  ctx.closePath()
  ctx.fill()
  // east face
  ctx.fillStyle = "#1b1e3c"
  ctx.beginPath()
  ctx.moveTo(p.x + hw, p.y)
  ctx.lineTo(p.x, p.y + hh)
  ctx.lineTo(p.x, p.y + hh - h)
  ctx.lineTo(p.x + hw, p.y - h)
  ctx.closePath()
  ctx.fill()
  // top
  ctx.fillStyle = "#262a4a"
  ctx.beginPath()
  ctx.moveTo(p.x, p.y - hh - h)
  ctx.lineTo(p.x + hw, p.y - h)
  ctx.lineTo(p.x, p.y + hh - h)
  ctx.lineTo(p.x - hw, p.y - h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = "rgba(124,92,255,.22)"
  ctx.lineWidth = 1
  ctx.stroke()
}

// workstation desk; screen glows brighter while its agent works
export function drawDesk(ctx, p, z, color, active, t, bob = 0) {
  const s = z
  ctx.fillStyle = "rgba(0,0,0,.35)"
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 6 * s, 26 * s, 9 * s, 0, 0, 7)
  ctx.fill()
  // desk top
  ctx.fillStyle = "#2a2c4a"
  ctx.beginPath()
  ctx.moveTo(p.x - 24 * s, p.y - 6 * s)
  ctx.lineTo(p.x, p.y - 16 * s)
  ctx.lineTo(p.x + 24 * s, p.y - 6 * s)
  ctx.lineTo(p.x, p.y + 4 * s)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = "rgba(124,92,255,.35)"
  ctx.lineWidth = 1
  ctx.stroke()
  // monitor glow (always alive — idle screens shimmer faintly)
  const g = Math.sin(t / 300 + bob) * 0.5 + 0.5
  ctx.fillStyle = active
    ? `rgba(120,200,255,${0.5 + g * 0.3})`
    : `rgba(80,90,140,${0.45 + g * 0.25})`
  ctx.shadowColor = color || "#7c5cff"
  ctx.shadowBlur = (active ? 14 : 5) * s
  ctx.fillRect(p.x - 7 * s, p.y - 22 * s, 14 * s, 9 * s)
  ctx.shadowBlur = 0
}

export function drawPlant(ctx, p, z, t) {
  const s = z
  ctx.fillStyle = "#8b6f47"
  ctx.fillRect(p.x - 5 * s, p.y - 6 * s, 10 * s, 7 * s)
  ctx.fillStyle = "#48bb78"
  ctx.shadowColor = "#48bb78"
  ctx.shadowBlur = 8 * s
  const sway = Math.sin(t / 900 + p.x) * 1.5 * s
  ctx.beginPath()
  ctx.moveTo(p.x - 9 * s, p.y - 5 * s)
  ctx.lineTo(p.x + sway, p.y - 24 * s)
  ctx.lineTo(p.x + 9 * s, p.y - 5 * s)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
}

export function drawSofa(ctx, p, z) {
  const s = z
  ctx.fillStyle = "#3c4566"
  rr(ctx, p.x - 22 * s, p.y - 12 * s, 44 * s, 14 * s, 5 * s)
  ctx.fill()
  ctx.fillStyle = "#4a5578"
  rr(ctx, p.x - 22 * s, p.y - 20 * s, 44 * s, 9 * s, 4 * s)
  ctx.fill()
  ctx.strokeStyle = "rgba(255,107,203,.3)"
  ctx.lineWidth = 1
  ctx.stroke()
}

export function drawReception(ctx, p, z, t) {
  const s = z
  ctx.fillStyle = "#3a3050"
  ctx.beginPath()
  ctx.moveTo(p.x - 30 * s, p.y - 4 * s)
  ctx.lineTo(p.x, p.y - 17 * s)
  ctx.lineTo(p.x + 30 * s, p.y - 4 * s)
  ctx.lineTo(p.x, p.y + 9 * s)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = "rgba(255,176,32,.5)"
  ctx.shadowColor = "#ffb020"
  ctx.shadowBlur = 10 * s
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.shadowBlur = 0
  // company sign
  const glow = 0.6 + Math.sin(t / 600) * 0.2
  ctx.font = `${9 * Math.min(s, 1.4)}px sans-serif`
  ctx.textAlign = "center"
  ctx.fillStyle = `rgba(255,215,0,${glow})`
  ctx.shadowColor = "#ffd700"
  ctx.shadowBlur = 12
  ctx.fillText("CRAZOR", p.x, p.y - 26 * s)
  ctx.shadowBlur = 0
}

// holographic meeting table; projection beam appears while a meeting runs
export function drawMeetingTable(ctx, p, z, t, meeting, topic) {
  ctx.fillStyle = "#1f2340"
  ctx.beginPath()
  ctx.ellipse(p.x, p.y, 64 * z, 30 * z, 0, 0, 7)
  ctx.fill()
  ctx.strokeStyle = "rgba(77,163,255,.6)"
  ctx.shadowColor = "#4da3ff"
  ctx.shadowBlur = 14
  ctx.stroke()
  ctx.shadowBlur = 0
  if (meeting) {
    const hh = Math.sin(t / 400) * 4
    ctx.globalAlpha = 0.18 + Math.sin(t / 300) * 0.06
    ctx.fillStyle = "#4da3ff"
    ctx.beginPath()
    ctx.moveTo(p.x - 46 * z, p.y)
    ctx.lineTo(p.x - 16 * z, p.y - 70 * z + hh)
    ctx.lineTo(p.x + 16 * z, p.y - 70 * z + hh)
    ctx.lineTo(p.x + 46 * z, p.y)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.font = `${11 * z}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillStyle = "#9fd0ff"
    ctx.shadowColor = "#4da3ff"
    ctx.shadowBlur = 12
    ctx.fillText(topic || "📊 全员会议进行中", p.x, p.y - 74 * z + hh)
    ctx.shadowBlur = 0
  }
}

const STATE_RING = new Set(["thinking", "working", "walking", "meeting"])

// pixel-lite character; returns a nameplate request for the overlap-free pass
export function drawAgent(ctx, p, z, a, t, followed) {
  const s = z
  const wob = a.state === "walking" ? Math.sin(t / 90) * 2.4 : Math.sin(t / 500 + a.bob) * 1.6
  const gy = p.y - wob * s

  // shadow
  ctx.fillStyle = "rgba(0,0,0,.4)"
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 4 * s, 12 * s, 4.5 * s, 0, 0, 7)
  ctx.fill()

  // status halo
  if (STATE_RING.has(a.state)) {
    ctx.strokeStyle = a.color
    ctx.globalAlpha = 0.5 + Math.sin(t / 200) * 0.25
    ctx.lineWidth = 2 * s
    ctx.shadowColor = a.color
    ctx.shadowBlur = 16 * s
    ctx.beginPath()
    ctx.ellipse(p.x, p.y + 3 * s, 15 * s, 6 * s, 0, 0, 7)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  // body
  ctx.fillStyle = a.color
  ctx.shadowColor = a.color
  ctx.shadowBlur = (a.flash > 0 ? 26 : 10) * s
  rr(ctx, p.x - 7 * s, gy - 26 * s, 14 * s, 22 * s, 6 * s)
  ctx.fill()
  // humans get a white suit stripe so they read differently from agents
  if (a.kind === "human") {
    ctx.fillStyle = "rgba(255,255,255,.85)"
    rr(ctx, p.x - 2 * s, gy - 24 * s, 4 * s, 18 * s, 2 * s)
    ctx.fill()
  }
  // head
  ctx.fillStyle = "#ffe3c8"
  ctx.beginPath()
  ctx.arc(p.x, gy - 34 * s, 7.5 * s, 0, 7)
  ctx.fill()
  ctx.shadowBlur = 0
  // hair = darker dept color
  ctx.fillStyle = shade(a.color, -30)
  ctx.beginPath()
  ctx.arc(p.x, gy - 36 * s, 7.5 * s, Math.PI, 0)
  ctx.fill()
  a.flash = Math.max(0, a.flash - 0.05)

  // thinking particle ring
  if (a.state === "thinking") {
    for (let i = 0; i < 6; i++) {
      const ang = t / 300 + i * 1.047
      const r = 14 * s
      const px = p.x + Math.cos(ang) * r
      const py = gy - 48 * s + Math.sin(ang) * r * 0.4
      ctx.fillStyle = "#fff"
      ctx.shadowColor = a.color
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(px, py, 1.8 * s, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  // holographic tool icon while working
  if (a.state === "working" && a.tool) {
    ctx.font = `${14 * s}px sans-serif`
    ctx.textAlign = "center"
    ctx.globalAlpha = 0.85 + Math.sin(t / 180) * 0.15
    ctx.fillText(a.tool, p.x + 16 * s, gy - 44 * s - Math.sin(t / 250) * 3 * s)
    ctx.globalAlpha = 1
  }

  // typing sparks while working at the desk
  if (a.state === "working") {
    const k = Math.sin(t / 70 + a.bob)
    if (k > 0.55) {
      ctx.fillStyle = "rgba(140,210,255,.9)"
      ctx.fillRect(p.x - 4 * s + (k * 7 * s) % (8 * s), gy - 14 * s, 1.6 * s, 1.6 * s)
    }
  }

  // speech bubble (typewriter reveal)
  let bubbleTop = gy - 62 * s
  if (a.bubble) {
    const el = t - a.bubble.start
    if (el > a.bubble.dur) {
      a.bubble = null
    } else {
      const txt = a.bubble.text.slice(0, Math.ceil(el / 40))
      ctx.font = `${11 * Math.min(s, 1.3)}px sans-serif`
      ctx.textAlign = "center"
      const bw = ctx.measureText(txt).width + 16
      ctx.fillStyle = "rgba(255,255,255,.95)"
      rr(ctx, p.x - bw / 2, gy - 86 * s, bw, 20, 9)
      ctx.fill()
      ctx.fillStyle = "#1a1c33"
      ctx.fillText(txt, p.x, gy - 86 * s + 14)
      bubbleTop = gy - 90 * s
    }
  }

  return {
    x: p.x,
    y: gy - 62 * s,
    limit: bubbleTop,
    text: a.name,
    color: a.color,
    followed,
    z: s,
  }
}

// nameplate pass — shifts plates up until they stop overlapping
export function drawNameplates(ctx, plates) {
  const placed = []
  // nearer (lower on screen) plates keep their spot; others dodge upward
  plates.sort((p1, p2) => p2.y - p1.y)
  for (const pl of plates) {
    ctx.font = `${10.5 * Math.min(pl.z, 1.4)}px sans-serif`
    ctx.textAlign = "center"
    const tw = ctx.measureText(pl.text).width + 12
    let x = pl.x - tw / 2
    let y = pl.y
    let guard = 0
    while (
      guard++ < 12 &&
      placed.some((r) => x < r.x + r.w && x + tw > r.x && y < r.y + 16 && y + 16 > r.y)
    ) {
      y -= 18
    }
    placed.push({ x, y, w: tw })
    ctx.fillStyle = "rgba(8,8,20,.78)"
    rr(ctx, x, y, tw, 16, 8)
    ctx.fill()
    if (pl.followed) {
      ctx.strokeStyle = "#00d4c8"
      ctx.lineWidth = 1
      ctx.shadowColor = "#00d4c8"
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    ctx.fillStyle = pl.followed ? "#00d4c8" : "#cfd3f7"
    ctx.fillText(pl.text, pl.x, y + 11.5)
  }
}
