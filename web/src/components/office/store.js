import { create } from "zustand"

const useOfficeStore = create((set, get) => ({
  employees: [],
  employeesLoading: true,
  selectedEmployeeId: null,
  hoveredEmployeeId: null,
  zoom: 1.0,
  metaCache: {}, // employeeId -> meta data
  meetingState: "idle", // idle | going | meeting | returning
  // M4 event-driven office
  delivered: 0, // artifacts delivered (entity.created completions)
  agentStatus: {}, // employeeId -> { state, task } live animation status

  setEmployees: (employees) => set({ employees, employeesLoading: false }),

  selectEmployee: (id) => set({ selectedEmployeeId: id }),

  setHoveredEmployee: (id) => set({ hoveredEmployeeId: id }),

  setZoom: (zoom) => set({ zoom: Math.max(0.35, Math.min(2.5, zoom)) }),

  setMeetingState: (meetingState) => set({ meetingState }),

  resetZoom: () => set({ zoom: 1.0 }),

  addDelivered: () => set((state) => ({ delivered: state.delivered + 1 })),

  setAgentStatus: (employeeId, status) =>
    set((state) => ({ agentStatus: { ...state.agentStatus, [employeeId]: status } })),

  setMeta: (employeeId, meta) =>
    set((state) => ({ metaCache: { ...state.metaCache, [employeeId]: meta } })),

  getSelectedEmployee: () => {
    const { employees, selectedEmployeeId } = get()
    return employees.find((e) => e.id === selectedEmployeeId) || null
  },
}))

export { useOfficeStore }
