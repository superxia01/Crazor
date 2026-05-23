import * as THREE from "three"
import { GRID, GRID_W, GRID_H, CELL_SIZE, WALL_H, DESK_H, AREA_LABELS } from "../data/officeLayout"

const FLOOR_A = 0x2d2d44
const FLOOR_B = 0x323258
const FLOOR_MEETING = 0x3b3b5c
const FLOOR_COMMON = 0x2a3a3a
const FLOOR_RECEPTION = 0x3a3545
const WALL_COLOR = 0x4a4a6a
const DESK_WOOD = 0x8B7355
const DESK_SCREEN = 0x333355
const CHAIR_COLOR = 0x555577
const MEETING_TABLE = 0x6B5B45
const SOFA_COLOR = 0x4a5568
const PLANT_GREEN = 0x48BB78
const PLANT_POT = 0x8B6F47
const RECEPTION_DESK = 0x7C6F5B

function cellToWorld(row, col) {
  return { x: (col - GRID_W / 2) * CELL_SIZE, z: (row - GRID_H / 2) * CELL_SIZE }
}

function makeMat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true })
}

function addBox(scene, w, h, d, x, y, z, color, castShadow = true, receiveShadow = true) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mesh = new THREE.Mesh(geo, makeMat(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  scene.add(mesh)
  return mesh
}

export class OfficeBuilder {
  static build(scene) {
    // 1. Floor tiles
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const cell = GRID[r][c]
        if (cell === 1) continue
        const { x, z } = cellToWorld(r, c)
        let color = (r + c) % 2 === 0 ? FLOOR_A : FLOOR_B
        if (cell === 3) color = (r + c) % 2 === 0 ? FLOOR_MEETING : FLOOR_MEETING + 0x050505
        if (cell === 4) color = (r + c) % 2 === 0 ? FLOOR_COMMON : FLOOR_COMMON + 0x050505
        if (cell === 6) color = (r + c) % 2 === 0 ? FLOOR_RECEPTION : FLOOR_RECEPTION + 0x050505
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE), makeMat(color))
        plane.rotation.x = -Math.PI / 2
        plane.position.set(x, 0, z)
        plane.receiveShadow = true
        scene.add(plane)
      }
    }

    // 2. Walls
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (GRID[r][c] !== 1) continue
        const { x, z } = cellToWorld(r, c)
        addBox(scene, CELL_SIZE, WALL_H, CELL_SIZE, x, WALL_H / 2, z, WALL_COLOR)
      }
    }

    // 3. Desks
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (GRID[r][c] !== 2) continue
        OfficeBuilder._buildDesk(scene, r, c)
      }
    }

    // 4. Meeting room
    OfficeBuilder._buildMeetingRoom(scene)

    // 5. Common area / break room
    OfficeBuilder._buildCommonArea(scene)

    // 6. Reception desk
    OfficeBuilder._buildReception(scene)

    // 7. Plants (cell type 7)
    OfficeBuilder._buildPlants(scene)

    // 8. Area labels as 3D sprites
    OfficeBuilder._buildLabels(scene)
  }

  static _buildDesk(scene, row, col) {
    const { x, z } = cellToWorld(row, col)
    // Desk surface
    addBox(scene, 0.7, 0.06, 0.5, x, DESK_H, z, DESK_WOOD)
    // Legs
    for (const [ox, oz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) {
      addBox(scene, 0.04, DESK_H, 0.04, x + ox, DESK_H / 2, z + oz, DESK_WOOD, false, false)
    }
    // Monitor
    addBox(scene, 0.28, 0.2, 0.02, x, DESK_H + 0.13, z - 0.12, DESK_SCREEN)
    addBox(scene, 0.04, 0.07, 0.04, x, DESK_H + 0.035, z - 0.12, 0x666666, false, false)
    // Keyboard
    addBox(scene, 0.2, 0.015, 0.08, x, DESK_H + 0.01, z + 0.05, 0x444466, false, false)
    // Chair
    addBox(scene, 0.32, 0.04, 0.32, x, DESK_H * 0.55, z + 0.45, CHAIR_COLOR)
    addBox(scene, 0.32, 0.22, 0.04, x, DESK_H * 0.55 + 0.13, z + 0.61, CHAIR_COLOR)
  }

  static _buildMeetingRoom(scene) {
    let sumR = 0, sumC = 0, count = 0
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (GRID[r][c] === 3) { sumR += r; sumC += c; count++ }
      }
    }
    if (count === 0) return
    const midR = Math.round(sumR / count)
    const midC = Math.round(sumC / count)
    const { x, z } = cellToWorld(midR, midC)

    // Conference table
    addBox(scene, 3.5, 0.08, 1.6, x, 0.42, z, MEETING_TABLE)

    // Chairs
    for (const [ox, oz] of [[-1.2, -1], [0, -1], [1.2, -1], [-1.2, 1], [0, 1], [1.2, 1]]) {
      addBox(scene, 0.3, 0.04, 0.3, x + ox, 0.26, z + oz, CHAIR_COLOR)
    }

    // Whiteboard on wall
    addBox(scene, 2.5, 1.2, 0.06, x, 1.0, z - 2.2, 0xeeeeee)
    // Frame
    addBox(scene, 2.6, 1.3, 0.03, x, 1.0, z - 2.25, 0x888888, false, false)
  }

  static _buildCommonArea(scene) {
    const cells = []
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (GRID[r][c] === 4) cells.push({ r, c })
      }
    }
    if (cells.length === 0) return

    const mid = cells[Math.floor(cells.length / 2)]
    const { x, z } = cellToWorld(mid.r, mid.c)

    // L-shaped sofa
    addBox(scene, 2.0, 0.2, 0.6, x - 0.3, 0.15, z - 0.5, SOFA_COLOR)
    addBox(scene, 2.0, 0.35, 0.08, x - 0.3, 0.22, z - 0.16, SOFA_COLOR)
    addBox(scene, 0.6, 0.2, 1.2, x + 0.7, 0.15, z + 0.1, SOFA_COLOR)
    addBox(scene, 0.08, 0.35, 1.2, x + 0.37, 0.22, z + 0.1, SOFA_COLOR)

    // Coffee table
    addBox(scene, 0.6, 0.04, 0.4, x - 0.3, 0.22, z + 0.3, MEETING_TABLE)

    // Water cooler
    addBox(scene, 0.3, 0.6, 0.3, x - 1.5, 0.3, z - 0.5, 0x999999)
    addBox(scene, 0.2, 0.15, 0.2, x - 1.5, 0.65, z - 0.5, 0x60A5FA)

    // Bookshelf
    addBox(scene, 0.3, 1.2, 1.5, x + 1.5, 0.6, z, 0x7C6F5B)
  }

  static _buildReception(scene) {
    const cells = []
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (GRID[r][c] === 6) cells.push({ r, c })
      }
    }
    if (cells.length === 0) return

    const mid = cells[Math.floor(cells.length / 2)]
    const { x, z } = cellToWorld(mid.r, mid.c)

    // Curved reception desk (approximated with 3 boxes)
    addBox(scene, 1.5, 0.5, 0.4, x, 0.25, z, RECEPTION_DESK)
    addBox(scene, 0.4, 0.5, 0.8, x - 0.7, 0.25, z + 0.3, RECEPTION_DESK)
    addBox(scene, 0.4, 0.5, 0.8, x + 0.7, 0.25, z + 0.3, RECEPTION_DESK)

    // Monitor on reception desk
    addBox(scene, 0.25, 0.18, 0.02, x, 0.6, z - 0.1, DESK_SCREEN)

    // Company sign behind reception
    addBox(scene, 2.0, 0.4, 0.05, x, 1.8, z - 1, 0x4F46E5)
  }

  static _buildPlants(scene) {
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (GRID[r][c] !== 7) continue
        const { x, z } = cellToWorld(r, c)
        // Pot
        addBox(scene, 0.25, 0.18, 0.25, x, 0.09, z, PLANT_POT, false, false)
        // Leaves — stacked cones
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 6), makeMat(PLANT_GREEN))
        cone1.position.set(x, 0.4, z)
        cone1.castShadow = true
        scene.add(cone1)
        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 6), makeMat(0x38A169))
        cone2.position.set(x, 0.65, z)
        cone2.castShadow = true
        scene.add(cone2)
      }
    }
  }

  static _buildLabels(scene) {
    for (const label of AREA_LABELS) {
      const { x, z } = cellToWorld(label.row, label.col)

      // Create text on a 2D canvas
      const canvas = document.createElement("canvas")
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext("2d")
      ctx.fillStyle = "rgba(0,0,0,0)"
      ctx.fillRect(0, 0, 256, 64)
      ctx.font = "bold 22px monospace"
      ctx.fillStyle = "rgba(200,200,220,0.7)"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label.text, 128, 32)

      const texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.NearestFilter
      texture.magFilter = THREE.NearestFilter

      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.position.set(x, 2.0, z)
      sprite.scale.set(3, 0.75, 1)
      scene.add(sprite)
    }
  }
}
