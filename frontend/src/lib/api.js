// REST client for the Leash FastAPI backend.
// Uses the httpOnly session cookie, plus a Bearer token fallback for browsers that block cross-site cookies.
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const KEY = 'leash_token'

const store = {
  get() { try { return localStorage.getItem(KEY) } catch { return null } },
  set(t) { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY) } catch { /* storage unavailable */ } },
}

async function req(method, url, body) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const token = store.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(BASE + url, { method, credentials: 'include', headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    const e = new Error('Cannot reach the Leash API. Check your connection and try again.')
    e.status = 0
    throw e
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) store.set(null)
    const e = new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong. Check your input and try again.')
    e.status = res.status
    throw e
  }
  return data
}

const session = (d) => { if (d.access_token) store.set(d.access_token); return d }

export const api = {
  health: () => req('GET', '/api/health'),
  me: async () => { const d = await req('GET', '/api/me'); if (!d.user) store.set(null); return d },
  signup: (email, password) => req('POST', '/api/auth/signup', { email, password }).then(session),
  login: (email, password) => req('POST', '/api/auth/login', { email, password }).then(session),
  logout: async () => { try { await req('POST', '/api/auth/logout') } finally { store.set(null) } },
  policy: (patch) => req('PUT', '/api/policy', patch),
  freeze: (frozen) => req('POST', '/api/freeze', { frozen }),
  reset: () => req('POST', '/api/reset'),
  simulate: (scenario) => req('POST', '/api/simulate', { scenario }),
  trades: () => req('GET', '/api/trades'),
  verify: (id) => req('GET', `/api/zk/verify/${id}`),
  tokens: () => req('GET', '/api/tokens'),
  issueToken: (network) => req('POST', '/api/tokens', { network }),
  modelInfo: () => req('GET', '/api/zk/model-info'),
}
