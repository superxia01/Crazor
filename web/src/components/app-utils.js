// Copyright (c) 2026 MeeJoy

import { CONTEXT_CONFIG } from "@/config/context"

export function isInteractiveDragTarget(target) {
  return Boolean(
    target?.closest?.(
      'button, a, input, textarea, select, summary, [role="button"], [data-no-window-drag]'
    )
  )
}

// No-op in web mode — window management is handled by the browser
export async function startNativeWindowDrag() {}

export async function toggleNativeWindowMaximize() {}

export function generateSummary(messages, t) {
  const userMessages = messages.filter((message) => message.role === "user")
  if (userMessages.length === 0) {
    return t("chat.historicalSummary")
  }

  const topics = userMessages.slice(0, 3).map((message) => {
    return message.content.length > 48
      ? `${message.content.slice(0, 48)}...`
      : message.content
  })

  return t("chat.summaryPrefix", {
    count: messages.length,
    topics: topics.join("；"),
  })
}

export function prepareMessages(allMessages, t, maxRecent = CONTEXT_CONFIG.MAX_MESSAGES) {
  if (allMessages.length <= maxRecent) {
    return allMessages
  }

  const systemMessages = allMessages.filter((message) => message.role === "system")
  const conversationMessages = allMessages.filter((message) => message.role !== "system")

  if (
    conversationMessages.length > maxRecent + 4 &&
    CONTEXT_CONFIG.ENABLE_AUTO_SUMMARY
  ) {
    const keepMessages = conversationMessages.slice(-maxRecent)
    const earlyMessages = conversationMessages.slice(0, -maxRecent)

    return [
      ...systemMessages,
      {
        role: "system",
        content: `[${t("chat.historicalSummary")}] ${generateSummary(earlyMessages, t)}`,
      },
      ...keepMessages,
    ]
  }

  return [...systemMessages, ...conversationMessages.slice(-maxRecent)]
}

export function prepareContext(currentMessages, newUserMessage, t) {
  const nextMessages = [...currentMessages, newUserMessage]

  if (nextMessages.length > CONTEXT_CONFIG.AUTO_COMPRESS_THRESHOLD) {
    return prepareMessages(nextMessages, t, CONTEXT_CONFIG.MAX_MESSAGES)
  }

  return nextMessages
}
