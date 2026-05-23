import { GRID, GRID_W, GRID_H } from "../data/officeLayout"

export class Pathfinder {
  constructor(grid) {
    this.w = GRID_W
    this.h = GRID_H
    this.walkable = []
    for (let r = 0; r < this.h; r++) {
      this.walkable[r] = []
      for (let c = 0; c < this.w; c++) {
        // Walls (1) are not walkable; everything else is
        this.walkable[r][c] = grid[r][c] !== 1
      }
    }
  }

  isWalkable(r, c) {
    if (r < 0 || r >= this.h || c < 0 || c >= this.w) return false
    return this.walkable[r][c]
  }

  findPath(startR, startC, endR, endC) {
    // Clamp to valid range
    const sr = Math.max(0, Math.min(this.h - 1, startR))
    const sc = Math.max(0, Math.min(this.w - 1, startC))
    const er = Math.max(0, Math.min(this.h - 1, endR))
    const ec = Math.max(0, Math.min(this.w - 1, endC))

    if (!this.isWalkable(sr, sc) || !this.isWalkable(er, ec)) return []
    if (sr === er && sc === ec) return [{ row: sr, col: sc }]

    // A* algorithm
    const key = (r, c) => `${r},${c}`
    const open = [{ r: sr, c: sc, g: 0, f: 0, parent: null }]
    const closed = new Set()

    const heuristic = (r, c) => Math.abs(r - er) + Math.abs(c - ec)

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]

    let iterations = 0
    const maxIterations = this.w * this.h * 2

    while (open.length > 0 && iterations++ < maxIterations) {
      // Sort by f score
      open.sort((a, b) => a.f - b.f)
      const current = open.shift()
      const ck = key(current.r, current.c)

      if (current.r === er && current.c === ec) {
        // Reconstruct path
        const path = []
        let node = current
        while (node) {
          path.unshift({ row: node.r, col: node.c })
          node = node.parent
        }
        return path
      }

      closed.add(ck)

      for (const [dr, dc] of dirs) {
        const nr = current.r + dr
        const nc = current.c + dc
        const nk = key(nr, nc)

        if (!this.isWalkable(nr, nc) || closed.has(nk)) continue

        const g = current.g + 1
        const existing = open.find((n) => n.r === nr && n.c === nc)
        if (existing) {
          if (g < existing.g) {
            existing.g = g
            existing.f = g + heuristic(nr, nc)
            existing.parent = current
          }
        } else {
          open.push({ r: nr, c: nc, g, f: g + heuristic(nr, nc), parent: current })
        }
      }
    }

    return [] // no path found
  }
}
