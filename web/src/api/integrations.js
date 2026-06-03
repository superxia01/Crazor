import { api } from './client.ts'

export async function getIntegrationChecks() {
  return api.get('/api/integrations/checks')
}

export async function getIntegrationStatus(connectorId) {
  return api.get(`/api/integrations/${encodeURIComponent(connectorId)}/status`)
}

export async function saveIntegrationConnectorConfig(connectorId, config = {}) {
  return api.post(`/api/integrations/${encodeURIComponent(connectorId)}/config`, config)
}

export async function testIntegrationConnector(connectorId) {
  return api.post(`/api/integrations/${encodeURIComponent(connectorId)}/test`)
}
