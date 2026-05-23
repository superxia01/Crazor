import * as THREE from "three"

export class InputHandler {
  constructor(camera, canvas, characterManager, store) {
    this.camera = camera
    this.canvas = canvas
    this.characterManager = characterManager
    this.store = store
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    canvas.addEventListener("pointerdown", this._onPointerDown)
    canvas.addEventListener("pointermove", this._onPointerMove)
  }

  setCharacters(groups) {
    this.characterGroups = groups
  }

  _getNDC(event) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    }
  }

  _findEmployeeId(object) {
    let current = object
    while (current) {
      if (current.userData?.employeeId) return current.userData.employeeId
      current = current.parent
    }
    return null
  }

  _onPointerDown(event) {
    const ndc = this._getNDC(event)
    this.pointer.set(ndc.x, ndc.y)
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const intersects = this.raycaster.intersectObjects(this.characterGroups || [], true)
    if (intersects.length > 0) {
      const employeeId = this._findEmployeeId(intersects[0].object)
      if (employeeId) {
        this.store.getState().selectEmployee(employeeId)
        this.characterManager.highlight(employeeId)
        return
      }
    }
    // Click on empty space — deselect
    this.store.getState().selectEmployee(null)
    this.characterManager.unhighlight()
  }

  _onPointerMove(event) {
    const ndc = this._getNDC(event)
    this.pointer.set(ndc.x, ndc.y)
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const intersects = this.raycaster.intersectObjects(this.characterGroups || [], true)
    if (intersects.length > 0) {
      const employeeId = this._findEmployeeId(intersects[0].object)
      if (employeeId) {
        this.canvas.style.cursor = "pointer"
        this.store.getState().setHoveredEmployee(employeeId)
        return
      }
    }
    this.canvas.style.cursor = "default"
    this.store.getState().setHoveredEmployee(null)
  }

  dispose() {
    this.canvas.removeEventListener("pointerdown", this._onPointerDown)
    this.canvas.removeEventListener("pointermove", this._onPointerMove)
  }
}
