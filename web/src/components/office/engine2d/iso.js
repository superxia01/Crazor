// M4 3D office: shared isometric-projection helpers for the canvas-2d engine
// (techniques ported from the verified crazor-3d-office-demo.html prototype)

export const TW = 48 // tile width in world px
export const TH = 24 // tile height in world px

// grid (col=gx, row=gy) → isometric world px
export function iso(gx, gy) {
  return { x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) }
}

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// '#rrggbb' lightened/darkened by amt (-255..255)
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = clamp((n >> 16) + amt, 0, 255)
  const g = clamp(((n >> 8) & 255) + amt, 0, 255)
  const b = clamp((n & 255) + amt, 0, 255)
  return `rgb(${r},${g},${b})`
}

// rounded-rect path (caller fills/strokes)
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  const rad = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

// stable per-string phase for idle bobbing
export function hashPhase(str = "") {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 6283
  return h / 1000
}
