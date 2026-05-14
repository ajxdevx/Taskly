const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function purgeLegacyAuth() {
  for (const key of ['taskflow_token', 'taskflow_user']) {
    localStorage.removeItem(key)
  }
}
purgeLegacyAuth()

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('taskly_token')
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })
  if (response.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem('taskly_token')
    localStorage.removeItem('taskly_user')
    window.location.reload()
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(payload.detail || 'Request failed')
  }
  return response.json() as Promise<T>
}
