// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

// ========================
// Cron Job API
// ========================
export async function getCronJobs() {
  return api.get('/api/cron')
}

export async function createCronJob({ prompt, schedule, name, deliver = 'local' }) {
  return api.post('/api/cron', {
    prompt: String(prompt || '').trim(),
    schedule: String(schedule || '').trim(),
    name: name?.trim() || null,
    deliver,
  })
}

export async function checkCronDependency() {
  return api.get('/api/cron/dependency')
}

export async function installCronDependency() {
  return api.post('/api/cron/dependency/install')
}

export async function restartHermesDashboard() {
  return api.post('/api/gateway/restart')
}

export async function pauseCronJob(id) {
  return api.post(`/api/cron/${encodeURIComponent(id)}/pause`)
}

export async function resumeCronJob(id) {
  return api.post(`/api/cron/${encodeURIComponent(id)}/resume`)
}

export async function triggerCronJob(id) {
  return api.post(`/api/cron/${encodeURIComponent(id)}/run`)
}

export async function deleteCronJob(id) {
  return api.delete(`/api/cron/${encodeURIComponent(id)}`)
}
