import type { ApiError, Application, AuditLog, User } from '../types'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'auth_token'

function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

function parseApiError(response: Response, body: unknown): ApiError {
  const fallback: ApiError = {
    error: response.statusText || 'Request failed',
    code: 'UNKNOWN_ERROR',
  }
  if (!body || typeof body !== 'object') {
    return fallback
  }

  const record = body as Record<string, unknown>
  const detail = record.detail ?? record

  if (
    detail &&
    typeof detail === 'object' &&
    !Array.isArray(detail) &&
    'error' in detail
  ) {
    return detail as ApiError
  }
  if (typeof detail === 'string') {
    return { error: detail, code: 'API_ERROR' }
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === 'object' && 'msg' in item
          ? String((item as { msg: string }).msg)
          : null,
      )
      .filter(Boolean)
    return {
      error: messages.join(', ') || 'Validation failed',
      code: 'VALIDATION_ERROR',
    }
  }
  return fallback
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...options, headers })
  } catch {
    throw {
      error:
        'Unable to reach the API. Make sure the backend is running (docker compose up).',
      code: 'NETWORK_ERROR',
    } satisfies ApiError
  }

  if (!response.ok) {
    let detail: ApiError = {
      error: response.statusText,
      code: 'UNKNOWN_ERROR',
    }
    try {
      const body = await response.json()
      detail = parseApiError(response, body)
    } catch {
      // ignore parse errors
    }
    throw detail
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>('/api/v1/auth/me'),

  listApplications: (status?: string) => {
    const query = status ? `?status=${status}` : ''
    return request<Application[]>(`/api/v1/applications${query}`)
  },

  getApplication: (id: string) =>
    request<Application>(`/api/v1/applications/${id}`),

  createApplication: (data: Record<string, unknown>) =>
    request<Application>('/api/v1/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateApplication: (id: string, data: Record<string, unknown>) =>
    request<Application>(`/api/v1/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  submitApplication: (id: string) =>
    request<Application>(`/api/v1/applications/${id}/submit`, {
      method: 'POST',
    }),

  transitionApplication: (
    id: string,
    action: string,
    comment?: string,
  ) =>
    request<Application>(`/api/v1/applications/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action, comment }),
    }),

  uploadFile: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Application>(`/api/v1/applications/${id}/file`, {
      method: 'POST',
      body: form,
    })
  },

  getAuditLogs: (id: string) =>
    request<AuditLog[]>(`/api/v1/applications/${id}/audit`),

  downloadFile: async (id: string, download = false) => {
    const token = getToken()
    const query = download ? '?download=true' : ''
    const response = await fetch(apiUrl(`/api/v1/applications/${id}/file${query}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) {
      let detail: ApiError = {
        error: response.statusText,
        code: 'UNKNOWN_ERROR',
      }
      try {
        const body = await response.json()
        detail = parseApiError(response, body)
      } catch {
        // ignore parse errors
      }
      throw detail
    }
    return response.blob()
  },
}
