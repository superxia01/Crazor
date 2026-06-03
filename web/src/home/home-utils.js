// Copyright (c) 2026 MeeJoy
//
// Data transformation functions for homepage cards.

import { toDate } from "./shared"

const FUNNEL_STAGES = ["新线索", "跟进中", "意向确认", "报价中", "谈判中", "已成交"]
const FUNNEL_COLORS = ["#94a3b8", "#60a5fa", "#818cf8", "#a78bfa", "#c084fc", "#10b981"]

/**
 * Build CRM funnel data from analytics overview contacts.
 * @param {object} contacts - { total, active, totalDeal, followUpsDue, byStage: {...} }
 * @param {Array} reminders - [{ id, contact_name, method, date }]
 */
export function buildCrmFunnelData(contacts, reminders = []) {
  if (!contacts?.byStage) return null

  const stages = FUNNEL_STAGES.map((name, index) => ({
    name,
    count: contacts.byStage[name] || 0,
    color: FUNNEL_COLORS[index],
  }))

  const total = stages.reduce((sum, s) => sum + s.count, 0) || 1

  const topReminders = (reminders || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3)

  return {
    stages: stages.map((s) => ({ ...s, percent: Math.round((s.count / total) * 100) })),
    total: contacts.total || 0,
    active: contacts.active || 0,
    totalDeal: contacts.totalDeal || 0,
    followUpsDue: contacts.followUpsDue || 0,
    topReminders,
  }
}

/**
 * Build content publishing stats from content pieces array.
 * @param {Array} pieces - content pieces from /api/crazor/content-pieces
 */
export function buildContentStats(pieces = []) {
  if (!pieces.length) return null

  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const byPlatform = {}
  const byStatus = {}
  let totalViews = 0
  let thisWeek = 0

  for (const piece of pieces) {
    // By platform
    const platform = piece.platform || "其他"
    byPlatform[platform] = (byPlatform[platform] || 0) + 1

    // By status
    const status = piece.status || "未知"
    byStatus[status] = (byStatus[status] || 0) + 1

    // Views
    totalViews += piece.views || 0

    // This week
    const pubDate = toDate(piece.published_at || piece.created_at)
    if (pubDate && pubDate >= weekAgo) thisWeek++
  }

  return { byPlatform, byStatus, totalViews, thisWeek, total: pieces.length }
}

/**
 * Build task board stats from analytics overview projects + cron jobs.
 * @param {object} projects - { totalProjects, todoTasks, doingTasks, doneTasks }
 * @param {Array} cronJobs - cron jobs list
 */
export function buildTaskStats(projects, cronJobs = []) {
  const result = {
    total: projects?.totalProjects || 0,
    todo: projects?.todoTasks || 0,
    doing: projects?.doingTasks || 0,
    done: projects?.doneTasks || 0,
    activeCron: 0,
    cronErrors: 0,
  }

  const activeStates = new Set(["active", "enabled", "running", "scheduled"])
  for (const job of cronJobs) {
    const state = String(job?.state || "").toLowerCase()
    if (state === "error" || state === "failed" || Boolean(job?.last_error)) {
      result.cronErrors++
    } else if (activeStates.has(state) || job?.enabled) {
      result.activeCron++
    }
  }

  return result
}

/**
 * Build 7-day activity series for mini chart.
 */
export function buildActivitySeries({ sessions = [], notes = [], cronJobs = [], now, language }) {
  const days = buildRecentDays(now, language)
  return days.map((day) => {
    const sessionCount = sessions.filter((s) => isSameDay(s.updated_at || s.created_at, day.date)).length
    const noteCount = notes.filter((n) => isSameDay(n.updated_at || n.created_at, day.date)).length
    const jobCount = cronJobs.filter((j) => isSameDay(j.last_run_at || j.updated_at, day.date)).length
    return {
      label: day.label,
      value: sessionCount * 3 + noteCount * 2 + jobCount,
    }
  })
}

function formatChartLabel(value, language) {
  const date = toDate(value)
  if (!date) return ""
  const tag = language === "zh-TW" ? "zh-TW" : language === "en" ? "en-US" : "zh-CN"
  return date.toLocaleDateString(tag, { weekday: "short" })
}

function buildRecentDays(now, language) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (6 - index))
    date.setHours(12, 0, 0, 0)
    return { date, label: formatChartLabel(date, language) }
  })
}

function isSameDay(left, right) {
  const ld = toDate(left)
  const rd = toDate(right)
  if (!ld || !rd) return false
  return ld.getFullYear() === rd.getFullYear() && ld.getMonth() === rd.getMonth() && ld.getDate() === rd.getDate()
}
