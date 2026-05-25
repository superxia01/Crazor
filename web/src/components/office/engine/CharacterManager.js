import * as THREE from "three"
import { GRID, GRID_W, GRID_H, CELL_SIZE } from "../data/officeLayout"
import { getEmployeeVisual, MEETING_SEATS } from "../data/employeeMap"

function cellToWorld(row, col) {
  return {
    x: (col - GRID_W / 2) * CELL_SIZE,
    z: (row - GRID_H / 2) * CELL_SIZE,
  }
}

function makeMat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true })
}

// Unique accessories per role
function addAccessory(group, type, bodyColor) {
  const white = 0xffffff
  const dark = 0x333333

  switch (type) {
    case "magnifier": {
      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4), makeMat(dark))
      handle.position.set(0.22, 0.05, 0)
      handle.rotation.z = Math.PI / 4
      group.add(handle)
      // Ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 8), makeMat(0x888888))
      ring.position.set(0.28, 0.18, 0)
      ring.rotation.y = Math.PI / 2
      group.add(ring)
      break
    }
    case "pen": {
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.25, 4), makeMat(0xEF4444))
      pen.position.set(0.2, 0.2, 0)
      pen.rotation.z = Math.PI / 6
      group.add(pen)
      break
    }
    case "phone": {
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), makeMat(dark))
      phone.position.set(0.2, 0.2, -0.1)
      phone.rotation.x = -0.3
      group.add(phone)
      // Screen glow
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.005), makeMat(0x60A5FA))
      screen.position.set(0.2, 0.205, -0.085)
      screen.rotation.x = -0.3
      group.add(screen)
      break
    }
    case "clipboard": {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.015), makeMat(0x92400E))
      board.position.set(0.22, 0.15, 0)
      group.add(board)
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.005), makeMat(white))
      paper.position.set(0.22, 0.16, 0.012)
      group.add(paper)
      break
    }
    case "glasses": {
      const glassMat = new THREE.MeshBasicMaterial({ color: dark })
      const lens1 = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 8), glassMat)
      lens1.position.set(-0.06, 0.43, -0.17)
      group.add(lens1)
      const lens2 = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 8), glassMat)
      lens2.position.set(0.06, 0.43, -0.17)
      group.add(lens2)
      // Bridge
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.008, 0.008), glassMat)
      bridge.position.set(0, 0.43, -0.17)
      group.add(bridge)
      break
    }
    case "hardhat": {
      const hatColor = 0xF59E0B
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 8), makeMat(hatColor))
      brim.position.set(0, 0.56, 0)
      group.add(brim)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), makeMat(hatColor))
      dome.position.set(0, 0.55, 0)
      group.add(dome)
      break
    }
    case "badge": {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.01), makeMat(0xEF4444))
      card.position.set(0, 0.08, -0.2)
      group.add(card)
      const lanyard = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.2, 0.01), makeMat(0x60A5FA))
      lanyard.position.set(0, 0.18, -0.2)
      group.add(lanyard)
      break
    }
    case "headset": {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 4, 8, Math.PI), makeMat(dark))
      band.position.set(0, 0.5, 0)
      band.rotation.x = Math.PI
      group.add(band)
      const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), makeMat(dark))
      earL.position.set(-0.22, 0.4, -0.05)
      earL.rotation.z = Math.PI / 2
      group.add(earL)
      const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), makeMat(dark))
      earR.position.set(0.22, 0.4, -0.05)
      earR.rotation.z = Math.PI / 2
      group.add(earR)
      // Mic
      const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), makeMat(dark))
      mic.position.set(0.15, 0.3, -0.15)
      mic.rotation.z = -0.5
      group.add(mic)
      break
    }
    case "box": {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.14), makeMat(0xA16207))
      box.position.set(0.22, 0.02, 0.05)
      group.add(box)
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.02, 0.03), makeMat(0xCA8A04))
      tape.position.set(0.22, 0.09, 0.05)
      group.add(tape)
      break
    }
    case "calendar": {
      // Small calendar / schedule board
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.015), makeMat(0xffffff))
      board.position.set(0.22, 0.15, 0)
      group.add(board)
      // Red top strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.02), makeMat(0xEF4444))
      strip.position.set(0.22, 0.25, 0)
      group.add(strip)
      // Grid lines
      for (let i = 0; i < 3; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.008, 0.005), makeMat(0x999999))
        line.position.set(0.22, 0.13 - i * 0.04, 0.01)
        group.add(line)
      }
      break
    }
    case "newspaper": {
      // Folded newspaper
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.01), makeMat(0xF5F5DC))
      paper.position.set(0.2, 0.12, 0)
      paper.rotation.z = 0.15
      group.add(paper)
      // Headline bar
      const headline = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.012), makeMat(dark))
      headline.position.set(0.2, 0.16, 0.01)
      headline.rotation.z = 0.15
      group.add(headline)
      break
    }
    case "camera": {
      // Camera body
      const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), makeMat(0x1a1a1a))
      camBody.position.set(0.2, 0.2, -0.08)
      group.add(camBody)
      // Lens
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), makeMat(0x333333))
      lens.position.set(0.2, 0.2, -0.12)
      lens.rotation.x = Math.PI / 2
      group.add(lens)
      // Flash
      const flash = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), makeMat(0xF5F5F5))
      flash.position.set(0.24, 0.25, -0.09)
      group.add(flash)
      break
    }
    case "megaphone": {
      // Megaphone body (cone)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), makeMat(0xEF4444))
      cone.position.set(0.2, 0.2, 0)
      cone.rotation.z = Math.PI / 4
      group.add(cone)
      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 4), makeMat(0x888888))
      handle.position.set(0.12, 0.13, 0)
      handle.rotation.z = Math.PI / 4
      group.add(handle)
      break
    }
    case "handshake": {
      // Briefcase
      const briefcase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), makeMat(0x5B3A1A))
      briefcase.position.set(0.2, 0.03, 0)
      group.add(briefcase)
      // Handle
      const bHandle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 4, 8, Math.PI), makeMat(0x8B6F47))
      bHandle.position.set(0.2, 0.1, 0)
      bHandle.rotation.x = Math.PI / 2
      group.add(bHandle)
      // Lock
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), makeMat(0xCA8A04))
      lock.position.set(0.2, 0.06, 0.04)
      group.add(lock)
      break
    }
  }
}

export class CharacterManager {
  constructor(scene, store) {
    this.scene = scene
    this.store = store
    this.characters = new Map()
    this.walkTargets = new Map()
    this.highlighted = null
  }

  createAll(employees) {
    this.dispose()

    for (const emp of employees) {
      if (emp.id === "vault-rules") continue
      const visual = getEmployeeVisual(emp.id)
      if (!visual) continue

      const group = this._createCharacter(emp.id, visual.color, emp.name, visual.accessory, visual.hatColor)
      const { x, z } = cellToWorld(visual.gridRow, visual.gridCol)
      group.position.set(x, 0.5, z + 0.3)
      this.characters.set(emp.id, group)
      this.scene.add(group)
    }
  }

  _createCharacter(employeeId, color, name, accessoryType, hatColor) {
    const group = new THREE.Group()
    group.userData = { employeeId, name }

    const colorObj = new THREE.Color(color)
    const lighterColor = colorObj.clone().lerp(new THREE.Color(0xffffff), 0.3)
    const darkerColor = colorObj.clone().lerp(new THREE.Color(0x000000), 0.2)

    const bodyMat = makeMat(color)
    const headMat = makeMat(lighterColor)

    // Body — cylinder with slight taper
    const bodyGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.42, 8)
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0
    body.castShadow = true
    group.add(body)

    // Head — sphere
    const headGeo = new THREE.SphereGeometry(0.2, 8, 6)
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 0.38
    head.castShadow = true
    group.add(head)

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.035, 4, 4)
    const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const pupilGeo = new THREE.SphereGeometry(0.018, 4, 4)
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 })

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeWhite)
      eye.position.set(side * 0.07, 0.41, -0.16)
      group.add(eye)
      const pupil = new THREE.Mesh(pupilGeo, pupilMat)
      pupil.position.set(side * 0.07, 0.41, -0.18)
      group.add(pupil)
    }

    // Mouth — small smile line
    const smileGeo = new THREE.TorusGeometry(0.04, 0.008, 4, 6, Math.PI)
    const smileMat = new THREE.MeshBasicMaterial({ color: darkerColor })
    const smile = new THREE.Mesh(smileGeo, smileMat)
    smile.position.set(0, 0.35, -0.18)
    smile.rotation.x = Math.PI
    group.add(smile)

    // Add role-specific accessory
    if (accessoryType) {
      addAccessory(group, accessoryType, color)
    }

    // Shadow disc
    const shadowGeo = new THREE.CircleGeometry(0.22, 8)
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
    const shadow = new THREE.Mesh(shadowGeo, shadowMat)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.48
    group.add(shadow)

    // Selection ring
    const ringGeo = new THREE.RingGeometry(0.25, 0.32, 16)
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.48
    ring.name = "selection-ring"
    group.add(ring)

    return group
  }

  update(delta, elapsed) {
    // Idle bounce — more visible
    for (const [id, group] of this.characters) {
      const phase = (id.charCodeAt(0) * 137 + id.charCodeAt(id.length - 1) * 53) % 1000
      group.position.y = 0.5 + Math.sin(elapsed * 2.5 + phase * 0.01) * 0.06
    }

    // Walk animation
    const toDelete = []
    for (const [id, walk] of this.walkTargets) {
      const group = this.characters.get(id)
      if (!group) continue

      const target = walk.path[walk.pathIndex]
      if (!target) { toDelete.push(id); continue }

      const { x, z } = cellToWorld(target.row, target.col)
      const dx = x - group.position.x
      const dz = z - (group.position.z - 0.3)
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < 0.05) {
        walk.pathIndex++
        if (walk.pathIndex >= walk.path.length) toDelete.push(id)
      } else {
        const speed = walk.speed * delta
        const ratio = Math.min(speed / dist, 1)
        group.position.x += dx * ratio
        group.position.z += dz * ratio
        // Walk bobbing
        group.scale.y = 1 + Math.sin(elapsed * 14) * 0.08
        // Face direction
        if (Math.abs(dx) > Math.abs(dz)) {
          group.rotation.y = dx > 0 ? -Math.PI / 2 : Math.PI / 2
        } else {
          group.rotation.y = dz > 0 ? Math.PI : 0
        }
      }
    }
    for (const id of toDelete) {
      const group = this.characters.get(id)
      if (group) { group.scale.y = 1; group.rotation.y = 0 }
      this.walkTargets.delete(id)
    }
  }

  moveTo(employeeId, targetRow, targetCol, pathfinder) {
    const group = this.characters.get(employeeId)
    if (!group) return
    const startCol = Math.round(group.position.x / CELL_SIZE + GRID_W / 2)
    const startRow = Math.round((group.position.z - 0.3) / CELL_SIZE + GRID_H / 2)
    const path = pathfinder.findPath(startRow, startCol, targetRow, targetCol)
    if (path.length > 0) this.walkTargets.set(employeeId, { path, pathIndex: 0, speed: 3 })
  }

  moveAllToMeeting(pathfinder) {
    let i = 0
    for (const [id] of this.characters) {
      if (i >= MEETING_SEATS.length) break
      const seat = MEETING_SEATS[i++]
      setTimeout(() => this.moveTo(id, seat.row, seat.col, pathfinder), i * 120)
    }
  }

  moveAllToDesks(pathfinder) {
    let i = 0
    for (const [id] of this.characters) {
      const visual = getEmployeeVisual(id)
      if (!visual) continue
      setTimeout(() => this.moveTo(id, visual.gridRow, visual.gridCol, pathfinder), i++ * 120)
    }
  }

  highlight(employeeId) {
    this.unhighlight()
    const group = this.characters.get(employeeId)
    if (!group) return
    this.highlighted = employeeId
    const ring = group.getObjectByName("selection-ring")
    if (ring) ring.material.opacity = 0.8
    group.scale.set(1.15, 1.15, 1.15)
  }

  unhighlight() {
    if (!this.highlighted) return
    const group = this.characters.get(this.highlighted)
    if (group) {
      const ring = group.getObjectByName("selection-ring")
      if (ring) ring.material.opacity = 0
      group.scale.set(1, 1, 1)
    }
    this.highlighted = null
  }

  getAllGroups() {
    return Array.from(this.characters.values())
  }

  getCharacterPosition(employeeId) {
    const group = this.characters.get(employeeId)
    if (!group) return null
    return group.position.clone()
  }

  dispose() {
    for (const [, group] of this.characters) {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
      this.scene.remove(group)
    }
    this.characters.clear()
    this.walkTargets.clear()
    this.highlighted = null
  }
}
