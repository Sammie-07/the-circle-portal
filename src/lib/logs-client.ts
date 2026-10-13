// Browser helpers for weekly attendance logs. They call /api/logs (server-side,
// cookie auth) and give up after a time limit with a clear message, so the UI
// can never sit on "Saving…" forever.

export interface LogInput {
  member_id: string
  week_of: string
  showed_up: boolean
  homework_done?: boolean
  questions_asked?: number
  notes?: string | null
}

const TIMEOUT_MS = 30_000

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
    // An expired session gets redirected to the sign-in page (HTML, not JSON).
    // Never mistake that for success.
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
    if (res.redirected || !isJson) {
      throw new Error('Your session expired. Refresh the page and sign in again (your entries are kept).')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Could not save (error ${res.status})`)
    return data as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Saving took too long. Check your connection and try again (your entries are kept).')
    }
    if (err instanceof TypeError) throw new Error('Network error. Check your connection and try again (your entries are kept).')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function saveLogs(rows: LogInput[]) {
  return call<{ ok: true; saved: number }>('/api/logs', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function loadWeekLogs(week: string) {
  return call<{ logs: Array<{ member_id: string; showed_up: boolean; homework_done: boolean; questions_asked: number | null; notes: string | null }> }>(`/api/logs?week=${encodeURIComponent(week)}`)
}

export function deleteLog(id: string) {
  return call<{ ok: true }>(`/api/logs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}
