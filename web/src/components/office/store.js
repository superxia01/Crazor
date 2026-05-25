import { create } from "zustand"

const useOfficeStore = create((set, get) => ({
  employees: [],
  employeesLoading: true,
  selectedEmployeeId: null,
  hoveredEmployeeId: null,
  zoom: 1.0,
  metaCache: {}, // employeeId -> meta data
  meetingState: "idle", // idle | going | meeting | returning

  setEmployees: (employees) => set({ employees, employeesLoading: false }),

  selectEmployee: (id) => set({ selectedEmployeeId: id }),

  setHoveredEmployee: (id) => set({ hoveredEmployeeId: id }),

  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(2.5, zoom)) }),

  setMeetingState: (meetingState) => set({ meetingState }),

  resetZoom: () => set({ zoom: 1.0 }),

  setMeta: (employeeId, meta) =>
    set((state) => ({ metaCache: { ...state.metaCache, [employeeId]: meta } })),

  getSelectedEmployee: () => {
    const { employees, selectedEmployeeId } = get()
    return employees.find((e) => e.id === selectedEmployeeId) || null
  },
}))

export { useOfficeStore }
