// Copyright (c) 2026 MeeJoy

// API module exports - re-exports all functions from domain modules

// Chat APIs
export { sendChat, sendChatStream, cancelChatStream, onChatToken, onChatDone, onChatError, onChatToolEvent } from './chat.js'

// Memory APIs
export { getMemories, addMemory, updateMemory, deleteMemory, compactMemories } from './memory.js'

// Task APIs
export { getTasks, createTask, updateTask, deleteTask } from './task.js'

// Config APIs
export { getConfig, setConfig, testGatewayConnection, getGatewayInfo, getHermesVersionInfo, updateHermesAgent } from './config.js'
export {
  readHermesUserConfig,
  writeHermesUserConfig,
  readHermesSoulConfig,
  writeHermesSoulConfig,
  readHermesMemoryConfig,
} from './hermes-config.js'
export {
  readChannelsConfig,
  writeChannelsConfig,
  getQqbotQrCode,
  checkQqbotQrCodeStatus,
  getQqbotQrImageSrc,
  getWeixinQrCode,
  checkWeixinQrCodeStatus,
  getWeixinQrImageSrc,
  normalizeQqbotQrInfo,
  normalizeWeixinQrInfo,
  getWhatsappQrCode,
} from './channels.js'

// Session APIs
export { getSessions, createSession, getSessionResponseId, setSessionResponseId, deleteSession, togglePinSession, updateSessionTitle, updateSessionModel, getMessages, addMessage, savePastedAttachment, importAttachmentFromPath } from './session.js'

// Workspace APIs
export { getWorkspaces, setWorkspace, getCurrentWorkspace, createTerminalSession, writeTerminalInput, resizeTerminalSession, closeTerminalSession, onTerminalOutput, onTerminalExit, createWorkspace, updateWorkspace, deleteWorkspace } from './workspace.js'

// Agent API
export { getAgents, getAgentProvider, getAgentProviderCapabilities } from './agent.js'

// Cron APIs
export { getCronJobs, createCronJob, checkCronDependency, installCronDependency, restartHermesDashboard, pauseCronJob, resumeCronJob, triggerCronJob, deleteCronJob } from './cron.js'

// Dashboard APIs
export { getLogs, getEnvVars, getPrimaryModelConfig, getConfiguredModelCandidates, getModelOptions, savePrimaryModelConfig, setDefaultModel, setEnvVar, deleteEnvVar, revealEnvVar, checkDashboardRunning, checkGatewayRunning, restartHermesGateway, stopHermesGateway, stopHermesDashboard } from './dashboard.js'

// Skills APIs
export { getSkills, getSkillDetail, toggleSkill, getToolsets, getMarketSkills, installSkill, uninstallSkill, checkSkillUpdates, updateSkill, inspectMarketSkill } from './skills.js'

// File APIs
export { listDirectory, readFile, getFilePreview, openFileExternal, writeFile, deleteFile, createDirectory } from './file.js'

// Notebook APIs
export {
  listNotebookTree,
  createNotebookFolder,
  renameNotebookFolder,
  deleteNotebookFolder,
  createNotebookNote,
  renameNotebookNote,
  deleteNotebookNote,
  getNotebookNote,
  updateNotebookNote,
  searchNotebookNotes,
  moveNotebookFolder,
  moveNotebookNote,
} from './notebook.js'

// Knowledge APIs
export {
  listKnowledgeTree,
  createKnowledgeFolder,
  renameKnowledgeFolder,
  deleteKnowledgeFolder,
  createKnowledgeNote,
  renameKnowledgeNote,
  deleteKnowledgeNote,
  getKnowledgeNote,
  updateKnowledgeNote,
  searchKnowledgeNotes,
  moveKnowledgeFolder,
  moveKnowledgeNote,
} from './notebook.js'

// Browser utilities
export {
  getPlatform,
  isMac,
  isWindows,
  isLinux,
  HERMES_SKILLS_INDEX_URL,
  BROWSER_ENV_STORAGE_KEY,
  loadBrowserEnvVars,
  saveBrowserEnvVars,
  fetchMarketIndex,
} from './browser-utils.js'
