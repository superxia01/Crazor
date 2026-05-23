import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

export class OfficeScene {
  constructor(container, store) {
    this.container = container
    this.store = store
    this.running = false
    this.clock = new THREE.Clock()
    this.updatables = []

    // Renderer — high DPI + antialias for sharp rendering
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    // Orthographic camera — isometric projection
    const aspect = container.clientWidth / container.clientHeight
    const frustum = 14
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      200,
    )
    this.camera.position.set(20, 20, 20)
    this.camera.lookAt(0, 0, 0)

    // OrbitControls — mouse zoom/rotate/pan
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.target.set(0, 0, 0)
    // Allow rotate but keep reasonable angles
    this.controls.minPolarAngle = Math.PI * 0.1
    this.controls.maxPolarAngle = Math.PI * 0.45
    // Zoom range (for ortho, this controls frustum scaling)
    this.controls.minZoom = 0.4
    this.controls.maxZoom = 3.0
    this.controls.enablePan = true
    this.controls.panSpeed = 0.8
    this.controls.rotateSpeed = 0.6
    this.controls.zoomSpeed = 1.2

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(10, 15, 10)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.near = 0.5
    dir.shadow.camera.far = 60
    dir.shadow.camera.left = -25
    dir.shadow.camera.right = 25
    dir.shadow.camera.top = 25
    dir.shadow.camera.bottom = -25
    this.scene.add(dir)

    // Fill light from opposite side
    const fill = new THREE.DirectionalLight(0xffffff, 0.3)
    fill.position.set(-8, 10, -8)
    this.scene.add(fill)

    // Resize observer
    this._onResize = () => this.resize()
    this._resizeObs = new ResizeObserver(this._onResize)
    this._resizeObs.observe(container)
  }

  addUpdatable(fn) {
    this.updatables.push(fn)
  }

  start() {
    this.running = true
    this.clock.start()
    this._animate()
  }

  _animate() {
    if (!this.running) return
    requestAnimationFrame(() => this._animate())
    const delta = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()
    for (const fn of this.updatables) fn(delta, elapsed)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    const aspect = w / h
    const f = 14
    this.camera.left = -f * aspect
    this.camera.right = f * aspect
    this.camera.top = f
    this.camera.bottom = -f
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  getScene() {
    return this.scene
  }
  getCamera() {
    return this.camera
  }
  getRenderer() {
    return this.renderer
  }

  dispose() {
    this.running = false
    this.controls.dispose()
    this._resizeObs?.disconnect()
    this.updatables = []
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
