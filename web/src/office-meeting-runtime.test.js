// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const appSource = readFileSync(resolve(repoRoot, "web/src/AppInner.jsx"), "utf8")
const officeViewSource = readFileSync(resolve(repoRoot, "web/src/components/office/OfficeView.jsx"), "utf8")
const officeToolbarSource = readFileSync(resolve(repoRoot, "web/src/components/office/ui/OfficeToolbar.jsx"), "utf8")

test("office meeting action prepares an AI Employee Runtime run before sending", () => {
  assert.ok(
    appSource.includes("prepareAiEmployeeRun") &&
      appSource.includes('OFFICE_DAILY_REPORT_EMPLOYEE_ID = "data-dashboard"') &&
      appSource.includes("buildOfficeDailyReportPrompt(run)") &&
      appSource.includes("handleOfficeMeeting"),
    "office meeting should route the daily report through the generic AI Employee Runtime"
  )
  assert.ok(
    appSource.includes("openDraftAndSendMessage") &&
      appSource.includes("forceActive: true"),
    "office meeting should send an explicit prepared message instead of waiting for React input state"
  )
  assert.ok(
    !appSource.includes("setTimeout(() => send(), 100)") &&
      !appSource.includes("setInput(\"请总结今天所有会话"),
    "office meeting should not use the fragile setInput + timeout send pattern"
  )
})

test("office toolbar exposes meeting intent to the app shell", () => {
  assert.ok(
    officeViewSource.includes("onMeeting") &&
      officeViewSource.includes("<OfficeToolbar sceneRef={sceneRef} onMeeting={onMeeting} />"),
    "OfficeView should pass the meeting callback to its toolbar"
  )
  assert.ok(
    officeToolbarSource.includes("onMeeting?.()") &&
      officeToolbarSource.indexOf('meetingState === "idle"') < officeToolbarSource.indexOf("onMeeting?.()"),
    "OfficeToolbar should fire the meeting callback when a meeting starts"
  )
})
