// Unified HTTP client for Crazor

const API_BASE = import.meta.env.VITE_API_BASE || ''

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private getToken(): string | null {
    try {
      return localStorage.getItem('crazor_token')
    } catch {
      return null
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const token = this.getToken()
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    if (response.status === 401) {
      try {
        const data = await response.json()
        if (data.needLogin) {
          try { localStorage.removeItem('crazor_token') } catch {}
          window.dispatchEvent(new CustomEvent('crazor:auth-expired'))
        }
      } catch {}
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`HTTP ${response.status}: ${text}`)
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
    const token = this.getToken()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response
  }
}

export const api = new ApiClient()
