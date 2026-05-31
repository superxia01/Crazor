// Unified HTTP client for Crazor

const API_BASE = ''

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      let message = text
      try {
        const data = JSON.parse(text)
        message = data?.error?.message || data?.error || data?.message || text
      } catch {
        // Keep raw text when the server did not return JSON.
      }
      throw new Error(`HTTP ${response.status}: ${message}`)
    }

    return response.json()
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' })
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }

  async stream(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      let message = text || response.statusText
      try {
        const data = JSON.parse(text)
        message = data?.error?.message || data?.error || data?.message || message
      } catch {
        // Keep raw text when the server did not return JSON.
      }
      throw new Error(`HTTP ${response.status}: ${message}`)
    }
    return response
  }
}

export const api = new ApiClient()
