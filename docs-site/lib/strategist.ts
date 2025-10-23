export type StrategistChatRequest = {
  prompt: string
  system?: string
  temperature?: number
  maxTokens?: number
}

export type StrategistChatResponse = {
  output: string
}

export type ReconciledQuery = {
  date?: string
  level?: 'adset' | 'campaign'
  account_ids?: string
  owner?: string
  lane?: 'ASC' | 'LAL_1' | 'LAL_2_5' | 'Contextual' | 'Sandbox' | 'Warm'
  category?: string
  timezone?: string
  limit?: number
  cursor?: string
  format?: 'json' | 'csv'
  key?: string
}

export async function strategistFetch<T = any>(
  path: string,
  init: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
  const url = base.replace(/\/$/, '') + '/api/strategist' + path
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const resp = await fetch(url, { ...init, headers, cache: 'no-store' })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Strategist request failed (${resp.status}): ${text}`)
  }
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return (await resp.json()) as T
  return (await resp.text()) as unknown as T
}

export async function strategistChat(
  body: StrategistChatRequest,
  accessToken?: string
): Promise<StrategistChatResponse> {
  return strategistFetch<StrategistChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  }, accessToken)
}

export async function fetchReconciled(
  query: ReconciledQuery,
  accessToken?: string
): Promise<any> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    params.set(k, String(v))
  }
  return strategistFetch<any>(`/reconciled?${params.toString()}`, { method: 'GET' }, accessToken)
}

export async function strategistExec(
  command: string,
  args: string[] = [],
  options: { dryRun?: boolean } = {},
  accessToken?: string
) {
  return strategistFetch<any>('/exec', {
    method: 'POST',
    body: JSON.stringify({ command, args, dryRun: options.dryRun }),
  }, accessToken)
}

export async function strategistIngest(
  payload: { csv?: string; csv_url?: string; key?: string; token?: string },
  accessToken?: string
) {
  const headers: HeadersInit = {}
  if (payload.token) (headers as any)['x-strategist-token'] = payload.token
  return strategistFetch<any>('/ingest', {
    method: 'POST',
    headers,
    body: JSON.stringify({ csv: payload.csv, csv_url: payload.csv_url, key: payload.key }),
  }, accessToken)
}


