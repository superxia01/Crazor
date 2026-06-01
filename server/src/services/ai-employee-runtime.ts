// Copyright (c) 2026 MeeJoy
// AI Employee Runtime MVP — prepares an auditable run envelope from real skills and context.

import { randomUUID } from 'node:crypto'
import * as skillCatalog from './skill-catalog'
import { getUnifiedContext } from './unified-context'
import { getAgentProviderDescriptor } from './agent-gateway'

export type AiEmployeeRunInput = {
  input?: string
  q?: string
  contact_id?: string
  context_types?: string | string[]
  context_limit?: number | string
}

export function listAiEmployees() {
  return publicCrazorSkills().map((skill) => toAiEmployee(skill))
}

export function getAiEmployee(id: string) {
  const skill = publicCrazorSkills().find((item: any) => item.id === id)
  return skill ? toAiEmployee(skill) : null
}

export function prepareAiEmployeeRun(id: string, input: AiEmployeeRunInput = {}) {
  const employee = getAiEmployee(id)
  if (!employee) return null

  const employeeMeta = skillCatalog.getSkillMeta(id)
  const systemMeta = skillCatalog.getSkillMeta('vault-rules')
  const provider = getAgentProviderDescriptor()
  const userInput = clean(input.input)
  const contextQuery = clean(input.q) || userInput
  const context = getUnifiedContext({
    q: contextQuery,
    contact_id: clean(input.contact_id),
    types: input.context_types || 'contact,project,task,follow_up,content_piece,transaction,doc_note,audit_log',
    limit: input.context_limit || 30,
  })

  return {
    id: `run-${randomUUID()}`,
    status: 'prepared',
    created_at: new Date().toISOString(),
    employee,
    input: userInput,
    provider: {
      id: provider.id,
      kind: provider.kind,
      display_name: provider.display_name,
      capability_ids: provider.capability_ids,
    },
    instructions: {
      system_skill: systemMeta ? compactSkillMeta(systemMeta) : null,
      employee_skill: employeeMeta ? compactSkillMeta(employeeMeta) : null,
      policy: '素材进 notebook，结论进 knowledge，结构化数据走数据库。',
    },
    context,
    handoff: {
      mcp_server: 'crazor',
      required_capabilities: ['crazor.mcp'],
      provider_capabilities: provider.capability_ids,
      ready_for_agent: true,
    },
  }
}

export function isSystemSkill(id: string): boolean {
  return skillCatalog.getCatalogEntry(id)?.category === 'system'
}

function publicCrazorSkills() {
  return skillCatalog.getCatalog({ source: 'crazor' }).filter((skill: any) => skill.category !== 'system')
}

function toAiEmployee(skill: any) {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: Array.isArray(skill.tags) ? skill.tags : [],
    trigger: skill.trigger || '',
    source: skill.source,
    runtime: {
      provider_binding: 'adapter',
      system_skill_id: 'vault-rules',
      status: 'available',
    },
  }
}

function compactSkillMeta(meta: any) {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    trigger: meta.trigger,
    mcpTools: Array.isArray(meta.mcpTools) ? meta.mcpTools : [],
    apis: Array.isArray(meta.apis) ? meta.apis : [],
    dbTables: Array.isArray(meta.dbTables) ? meta.dbTables : [],
    externalApis: Array.isArray(meta.externalApis) ? meta.externalApis : [],
  }
}

function clean(value: unknown): string {
  return String(value || '').trim()
}
