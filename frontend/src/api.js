const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const message = typeof data === 'string' ? data : Object.values(data || {})
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .join(' ')
    throw new Error(message || `A API respondeu com status ${response.status}.`)
  }
  return data
}

export function allPages(path, options) {
  return api(path, options).then(async (first) => {
    if (Array.isArray(first)) return first
    const results = [...(first?.results || [])]
    let next = first?.next
    while (next) {
      const nextUrl = new URL(next, window.location.origin)
      const response = await fetch(`${API_BASE}${nextUrl.pathname.replace(/^\/api/, '')}${nextUrl.search}`)
      const page = await response.json()
      if (!response.ok) throw new Error('Não foi possível carregar todos os registros.')
      results.push(...(page.results || []))
      next = page.next
    }
    return results
  })
}
