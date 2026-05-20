// Copyright (c) 2026 MeeJoy

import { api } from './client.ts'

function safeParseChannels(content) {
  try {
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function readChannelsConfig() {
  try {
    const data = await api.get('/api/channels')
    return data
  } catch (error) {
    console.warn('Failed to read channels config:', error)
    return {}
  }
}

export async function writeChannelsConfig(config) {
  return api.patch('/api/channels', config)
}

export async function getWeixinQrCode() {
  return normalizeWeixinQrInfo(await api.post('/api/channels/weixin/qrcode'))
}

export function normalizeWeixinQrInfo(info) {
  if (!info || typeof info !== 'object') {
    return {
      qrcode: '',
      qrcodeImgContent: '',
      qrcodeImageDataUrl: '',
    }
  }

  return {
    qrcode: String(info.qrcode || '').trim(),
    qrcodeImgContent: String(info.qrcodeImgContent || info.qrcode_img_content || '').trim(),
    qrcodeImageDataUrl: String(info.qrcodeImageDataUrl || info.qrcode_image_data_url || '').trim(),
  }
}

export function getWeixinQrImageSrc(info) {
  const qrInfo = normalizeWeixinQrInfo(info)
  return qrInfo.qrcodeImageDataUrl || qrInfo.qrcodeImgContent
}

export async function checkWeixinQrCodeStatus(qrcode) {
  return api.post('/api/channels/weixin/qrcode/status', { qrcode })
}

export async function getQqbotQrCode() {
  return normalizeQqbotQrInfo(await api.post('/api/channels/qqbot/qrcode'))
}

export function normalizeQqbotQrInfo(info) {
  if (!info || typeof info !== 'object') {
    return {
      taskId: '',
      connectUrl: '',
      qrcodeImageDataUrl: '',
      expiresInSeconds: 600,
      pollIntervalMs: 2000,
    }
  }

  return {
    taskId: String(info.taskId || info.task_id || '').trim(),
    connectUrl: String(info.connectUrl || info.connect_url || '').trim(),
    qrcodeImageDataUrl: String(info.qrcodeImageDataUrl || info.qrcode_image_data_url || '').trim(),
    expiresInSeconds: Number(info.expiresInSeconds || info.expires_in_seconds || 600),
    pollIntervalMs: Number(info.pollIntervalMs || info.poll_interval_ms || 2000),
  }
}

export function getQqbotQrImageSrc(info) {
  return normalizeQqbotQrInfo(info).qrcodeImageDataUrl
}

export async function checkQqbotQrCodeStatus(taskId) {
  return api.post('/api/channels/qqbot/qrcode/status', { taskId })
}

export async function getWhatsappQrCode() {
  return api.post('/api/channels/whatsapp/qrcode')
}
