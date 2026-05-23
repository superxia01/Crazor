import { useEffect, useRef, useState } from "react"
import { useOfficeStore } from "../store"

export default function EmployeeBubble({ employeeId, sceneRef }) {
  const elRef = useRef(null)
  const employees = useOfficeStore((s) => s.employees)
  const hoveredId = useOfficeStore((s) => s.hoveredEmployeeId)
  const selectedId = useOfficeStore((s) => s.selectedEmployeeId)
  const employee = employees.find((e) => e.id === employeeId)
  const isHovered = hoveredId === employeeId
  const isSelected = selectedId === employeeId

  useEffect(() => {
    let raf
    const update = () => {
      if (!elRef.current || !sceneRef.current) {
        raf = requestAnimationFrame(update)
        return
      }
      const { charManager, scene } = sceneRef.current
      const pos = charManager.getCharacterPosition(employeeId)
      if (!pos) {
        raf = requestAnimationFrame(update)
        return
      }
      const camera = scene.getCamera()
      const renderer = scene.getRenderer()
      const vec = pos.clone()
      vec.y += 0.85 // above head
      vec.project(camera)

      const hw = renderer.domElement.clientWidth / 2
      const hh = renderer.domElement.clientHeight / 2
      const sx = vec.x * hw + hw
      const sy = -vec.y * hh + hh

      // Check if behind camera
      if (vec.z > 1) {
        elRef.current.style.display = "none"
      } else {
        elRef.current.style.display = ""
        elRef.current.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy}px)`
      }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [employeeId, sceneRef])

  if (!employee) return null

  return (
    <div
      ref={elRef}
      className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap"
    >
      <div
        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium shadow-sm transition-all duration-150 ${
          isSelected
            ? "bg-primary text-primary-foreground"
            : isHovered
              ? "bg-foreground text-background"
              : "bg-background/90 text-foreground border border-border"
        }`}
      >
        {employee.name}
      </div>
    </div>
  )
}
