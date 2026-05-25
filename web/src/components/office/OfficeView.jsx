import { useRef, useEffect, useState } from "react"
import { Gamepad2Icon, PowerIcon } from "lucide-react"
import { ViewFrame } from "@/components/view-frame"
import { Button } from "@/components/ui/button"
import { useOfficeStore } from "./store"
import { OfficeScene } from "./engine/Scene"
import { OfficeBuilder } from "./engine/OfficeBuilder"
import { CharacterManager } from "./engine/CharacterManager"
import { Pathfinder } from "./engine/Pathfinding"
import { InputHandler } from "./engine/InputHandler"
import { GRID } from "./data/officeLayout"
import EmployeeBubble from "./ui/EmployeeBubble"
import EmployeePanel from "./ui/EmployeePanel"
import OfficeToolbar from "./ui/OfficeToolbar"

const OFFICE_ENABLED_KEY = "crazor-office-3d-enabled"

export default function OfficeView({ onSelectEmployee }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(OFFICE_ENABLED_KEY) === "true" } catch { return false }
  })

  const employees = useOfficeStore((s) => s.employees)
  const selectedEmployeeId = useOfficeStore((s) => s.selectedEmployeeId)

  // Fetch employees on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch("/api/crazor/skills/catalog")
        if (resp.ok && !cancelled) {
          const catalog = await resp.json()
          useOfficeStore.getState().setEmployees(catalog)
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Initialize 3D scene only when enabled
  useEffect(() => {
    if (!enabled || !containerRef.current || sceneRef.current) return

    const scene = new OfficeScene(containerRef.current, useOfficeStore)
    OfficeBuilder.build(scene.getScene())

    const pathfinder = new Pathfinder(GRID)

    const charManager = new CharacterManager(scene.getScene(), useOfficeStore)
    const inputHandler = new InputHandler(
      scene.getCamera(),
      scene.getRenderer().domElement,
      charManager,
      useOfficeStore,
    )

    // Register update loop
    scene.addUpdatable((delta, elapsed) => {
      charManager.update(delta, elapsed)
    })

    sceneRef.current = { scene, charManager, inputHandler, pathfinder }
    scene.start()

    return () => {
      inputHandler.dispose()
      charManager.dispose()
      scene.dispose()
      sceneRef.current = null
    }
  }, [enabled])

  // Sync employees → 3D characters
  useEffect(() => {
    if (!sceneRef.current || employees.length === 0) return
    const { charManager, inputHandler } = sceneRef.current
    charManager.createAll(employees)
    inputHandler.setCharacters(charManager.getAllGroups())
  }, [employees])

  const handleToggle = () => {
    const next = !enabled
    setEnabled(next)
    try { localStorage.setItem(OFFICE_ENABLED_KEY, String(next)) } catch { /* ignore */ }
  }

  // Office disabled — show closed state
  if (!enabled) {
    return (
      <ViewFrame title="AI 数字员工办公室" description="2.5D 像素风虚拟办公空间">
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
              <Gamepad2Icon className="size-10 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">3D 办公室已关闭</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                开启后可在虚拟办公空间中查看 AI 数字员工
              </p>
            </div>
            <Button onClick={handleToggle} className="gap-2">
              <PowerIcon className="size-4" />
              开启 3D 办公室
            </Button>
          </div>
        </div>
      </ViewFrame>
    )
  }

  // Office enabled — render 3D scene
  return (
    <ViewFrame
      title="AI 数字员工办公室"
      description="2.5D 像素风虚拟办公空间"
      badge="BETA"
      actions={
        <div className="flex items-center gap-2">
          <OfficeToolbar sceneRef={sceneRef} />
          <Button variant="ghost" size="icon" className="size-7" onClick={handleToggle} title="关闭办公室">
            <PowerIcon className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      }
    >
      <div className="relative h-full w-full overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />
        {employees
          .filter((e) => e.id !== "vault-rules")
          .map((emp) => (
            <EmployeeBubble key={emp.id} employeeId={emp.id} sceneRef={sceneRef} />
          ))}
        {selectedEmployeeId && (
          <EmployeePanel sceneRef={sceneRef} onStartChat={onSelectEmployee} />
        )}
      </div>
    </ViewFrame>
  )
}
