// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const submenuSource = readFileSync(new URL("./layout/HermesSubmenu.jsx", import.meta.url), "utf8")
const appSource = readFileSync(new URL("../AppInner.jsx", import.meta.url), "utf8")
const cronSource = readFileSync(new URL("../CronView.jsx", import.meta.url), "utf8")
const cronListSource = readFileSync(new URL("./layout/CronList.jsx", import.meta.url), "utf8")
const zhLocaleSource = readFileSync(new URL("../locales/zh.json", import.meta.url), "utf8")

test("hermes submenu keeps config entries but no longer owns skills", () => {
  for (const id of [
    "model-config",
    "commands",
    "logs",
    "analytics",
    "channels",
    "memory",
    "agents",
  ]) {
    assert.ok(
      submenuSource.includes(`id: "${id}"`) || submenuSource.includes(`id: '${id}'`),
      `Hermes submenu should include ${id}`
    )
  }
  assert.ok(
    !submenuSource.includes('id: "skills"') && !submenuSource.includes("id: 'skills'"),
    "skills should move out of the Hermes submenu"
  )
})

test("hermes primary navigation label does not masquerade as app settings", () => {
  assert.ok(
    zhLocaleSource.includes('"hermes": "Agent中枢"'),
    "Hermes primary nav should describe the Agent hub instead of app settings"
  )
  assert.ok(
    !zhLocaleSource.includes('"hermes": "系统设置"'),
    "Hermes primary nav must not look like the app settings entry"
  )
})

test("prompt market remains the active primary AI digital workers entry", () => {
  const hermesViewsStart = appSource.indexOf("const HERMES_SIDEBAR_VIEWS = [")
  const hermesViewsEnd = appSource.indexOf("]\n\nfunction resolveHermesSubmenuTargetView", hermesViewsStart)
  const hermesViewsBlock = appSource.slice(hermesViewsStart, hermesViewsEnd)

  assert.ok(hermesViewsStart >= 0 && hermesViewsEnd > hermesViewsStart, "Hermes sidebar view block should exist")
  assert.ok(
    !hermesViewsBlock.includes('"prompt-market"'),
    "direct AI digital workers navigation should not light up the Hermes/settings primary item"
  )
  assert.ok(
    appSource.includes('if (id === "prompt-market") return "prompt-market"'),
    "Hermes submenu can still route to the prompt market when selected from the Hermes middle panel"
  )
})

test("skills is a primary sidebar item outside the Hermes submenu", () => {
  const skillsIndex = appSource.indexOf('id: "hermes-skills"')
  const filesIndex = appSource.indexOf('id: "files"')

  assert.ok(skillsIndex >= 0, "primary sidebar should include skills")
  assert.ok(filesIndex >= 0, "primary sidebar should include files")
  assert.ok(skillsIndex < filesIndex, "skills should sit before files")
  assert.ok(appSource.includes('labelKey: "nav.skillsList"'), "primary skills item should reuse the dedicated skills list label")
  assert.ok(appSource.includes('descriptionKey: "nav.skillsDescription"'), "primary skills item should reuse skills description")
  assert.ok(appSource.includes("icon: PackageIcon"), "primary skills item should use the skills package icon")
  assert.ok(appSource.includes('view === "hermes-skills" && <HermesSkillsPage />'), "skills should render the existing skills page")
})

test("app shell routes migrated hermes submenu items without changing the existing three behaviors", () => {
  assert.ok(
    appSource.includes("function resolveHermesSubmenuTargetView") &&
      appSource.includes('if (id === "model-config") return "tasks"') &&
      appSource.includes('if (id === "commands") return "commands"') &&
      appSource.includes('if (id === "logs") return "memory"'),
    "existing Hermes submenu items should keep their current target views through a shared resolver"
  )
  for (const viewId of ["analytics", "channels", "memory", "agents"]) {
    assert.ok(
      appSource.includes(`if (id === "${viewId}") return`) ||
        appSource.includes(`view === "${viewId}"`),
      `app shell should route Hermes submenu item ${viewId}`
    )
  }
  assert.ok(
    !appSource.includes('if (id === "skills") return "hermes-skills"'),
    "skills should not be routed through the Hermes submenu anymore"
  )
})

test("cron page migration must preserve the current real cron actions", () => {
  assert.ok(
    appSource.includes('view === "cron" && <CronView />'),
    "app shell should render the cron main page when view is cron"
  )

  for (const symbol of [
    "getCronJobs",
    "createCronJob",
    "pauseCronJob",
    "resumeCronJob",
    "triggerCronJob",
    "deleteCronJob",
    "checkCronDependency",
    "installCronDependency",
  ]) {
    assert.ok(
      cronSource.includes(symbol),
      `cron page should keep using ${symbol}`
    )
  }
})

test("cron page should not keep a dedicated middle column after migration", () => {
  assert.ok(
    !appSource.includes('setActiveMiddleView("cron")'),
    "cron navigation should not open a dedicated middle column anymore"
  )
  assert.ok(
    !appSource.includes('activeMiddleView === "cron"'),
    "app shell should not render cron-specific middle column content"
  )
  assert.ok(
    !appSource.includes('"sessions", "cron", "hermes-submenu", "notebook", "files"'),
    "middle column content set should no longer treat cron as a middle-column view"
  )
})

test("cron middle list is also migrated while preserving the real cron actions", () => {
  for (const symbol of [
    "getCronJobs",
    "pauseCronJob",
    "resumeCronJob",
    "triggerCronJob",
    "deleteCronJob",
    "formatNextRun",
    "onCreate",
  ]) {
    assert.ok(
      cronListSource.includes(symbol),
      `cron middle list should include ${symbol}`
    )
  }
})

test("hermes config and channel APIs exist for real memory and channel migration", () => {
  const hermesConfigPath = new URL("../api/hermes-config.js", import.meta.url)
  const channelsApiPath = new URL("../api/channels.js", import.meta.url)

  assert.ok(existsSync(hermesConfigPath), "hermes config API file should exist")
  assert.ok(existsSync(channelsApiPath), "channels API file should exist")

  const hermesConfigSource = readFileSync(hermesConfigPath, "utf8")
  const channelsApiSource = readFileSync(channelsApiPath, "utf8")

  for (const symbol of [
    "readHermesUserConfig",
    "writeHermesUserConfig",
    "readHermesSoulConfig",
    "writeHermesSoulConfig",
    "readHermesMemoryConfig",
  ]) {
    assert.ok(
      hermesConfigSource.includes(symbol),
      `hermes config API should include ${symbol}`
    )
  }

  for (const symbol of [
    "readChannelsConfig",
    "writeChannelsConfig",
    "getWeixinQrCode",
    "getWhatsappQrCode",
    "normalizeWeixinQrInfo",
    "checkWeixinQrCodeStatus",
  ]) {
    assert.ok(
      channelsApiSource.includes(symbol),
      `channels API should include ${symbol}`
    )
  }
})
