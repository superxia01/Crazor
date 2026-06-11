// M4 3D office: particle effects (message bezier flight + trail, arrival
// ripples, completion confetti, artifact fly-out) — ported from the demo.

import { iso, lerp } from "./iso"

export class Effects {
  constructor() {
    this.msgs = []      // bezier message particles between two agents
    this.parts = []     // confetti particles
    this.ripples = []   // arrival ripples (world iso coords)
    this.artifacts = [] // deliverables flying to the top-right HUD
    this.onDeliver = null
  }

  // from / to: agents (live grid coords are re-read on arrival)
  sendMsg(from, to, color) {
    this.msgs.push({ ax: from.gx, ay: from.gy, b: to, t: 0, dur: 1100 + Math.random() * 300, c: color })
  }

  confetti(gx, gy) {
    const p = iso(gx, gy)
    for (let i = 0; i < 26; i++) {
      this.parts.push({
        x: p.x, y: p.y - 46,
        vx: (Math.random() - 0.5) * 4.5, vy: -Math.random() * 5 - 1.5,
        g: 0.16, life: 1, decay: 0.012 + Math.random() * 0.012,
        c: ["#ffd700", "#ff4d88", "#00d4c8", "#7c5cff", "#6bff7a"][i % 5],
        s: 2 + Math.random() * 3,
      })
    }
  }

  ripple(x, y, c) {
    this.ripples.push({ x, y, r: 4, a: 1, c })
  }

  artifact(gx, gy, label) {
    const p = iso(gx, gy)
    this.artifacts.push({ x: p.x, y: p.y - 50, t: 0, label })
    this.onDeliver?.()
  }

  update(dt) {
    for (let i = this.msgs.length - 1; i >= 0; i--) {
      const m = this.msgs[i]
      m.t += dt
      if (m.t >= m.dur) {
        const tp = iso(m.b.gx, m.b.gy)
        this.ripple(tp.x, tp.y, m.c)
        m.b.flash = 1
        this.msgs.splice(i, 1)
      }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= p.decay
      if (p.life <= 0) this.parts.splice(i, 1)
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]
      r.r += 1.6; r.a -= 0.03
      if (r.a <= 0) this.ripples.splice(i, 1)
    }
    for (let i = this.artifacts.length - 1; i >= 0; i--) {
      const a = this.artifacts[i]
      a.t += dt / 900
      if (a.t >= 1) this.artifacts.splice(i, 1)
    }
  }

  // drawn between scene and HUD layers; project: world iso → screen px
  drawWorld(ctx, project, z) {
    // message particles: quadratic bezier flight + 5-segment fading trail
    for (const m of this.msgs) {
      const k = Math.min(1, m.t / m.dur)
      const A = iso(m.ax, m.ay)
      const B = iso(m.b.gx, m.b.gy)
      const mx = (A.x + B.x) / 2
      const my = Math.min(A.y, B.y) - 90
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      for (let j = 4; j >= 0; j--) {
        const bk = Math.max(0, ease - j * 0.035)
        const bx = lerp(lerp(A.x, mx, bk), lerp(mx, B.x, bk), bk)
        const by = lerp(lerp(A.y - 40, my, bk), lerp(my, B.y - 40, bk), bk)
        const bs = project({ x: bx, y: by })
        ctx.globalAlpha = 0.5 - j * 0.09
        ctx.fillStyle = m.c
        ctx.beginPath()
        ctx.arc(bs.x, bs.y, Math.max(0.5, (4 - j * 0.6) * z), 0, 7)
        ctx.fill()
      }
      const px = lerp(lerp(A.x, mx, ease), lerp(mx, B.x, ease), ease)
      const py = lerp(lerp(A.y - 40, my, ease), lerp(my, B.y - 40, ease), ease)
      const sp = project({ x: px, y: py })
      ctx.globalAlpha = 1
      ctx.fillStyle = "#fff"
      ctx.shadowColor = m.c
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 4.5 * z, 0, 7)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // arrival ripples
    for (const r of this.ripples) {
      const sp = project({ x: r.x, y: r.y })
      ctx.strokeStyle = r.c
      ctx.globalAlpha = Math.max(0, r.a)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(sp.x, sp.y, r.r * z, r.r * 0.45 * z, 0, 0, 7)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // confetti
    for (const p of this.parts) {
      const sp = project({ x: p.x, y: p.y })
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.c
      ctx.fillRect(sp.x, sp.y, p.s * z, p.s * z)
      ctx.globalAlpha = 1
    }
  }

  // artifacts fly to the top-right HUD corner (screen-space target)
  drawArtifacts(ctx, project, w) {
    for (const a of this.artifacts) {
      const sp = project({ x: a.x, y: a.y })
      const k = a.t
      const ex = lerp(sp.x, w - 120, k * k)
      const ey = lerp(sp.y, 26, k * k)
      ctx.font = "16px sans-serif"
      ctx.textAlign = "center"
      ctx.globalAlpha = 1 - k * 0.3
      ctx.fillText("✨", ex, ey)
      ctx.font = "10px sans-serif"
      ctx.fillStyle = "#ffd700"
      ctx.fillText(a.label, ex, ey + 14)
      ctx.globalAlpha = 1
    }
  }

  clear() {
    this.msgs.length = 0
    this.parts.length = 0
    this.ripples.length = 0
    this.artifacts.length = 0
  }
}
