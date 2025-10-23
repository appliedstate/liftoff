"use client"

import { useEffect, useMemo, useState } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase-browser'
import { fetchReconciled, strategistChat, strategistExec, strategistIngest, type ReconciledQuery } from '@/lib/strategist'

export default function StrategistPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [accessToken, setAccessToken] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState<'chat' | 'reconciled' | 'terminal' | 'ingest'>('chat')

  const [chatPrompt, setChatPrompt] = useState('Summarize yesterday performance by owner and lane, then suggest bid cap adjustments for underperformers with ROAS < 1.2.')
  const [chatOutput, setChatOutput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [query, setQuery] = useState<ReconciledQuery>({ level: 'adset', limit: 50 })
  const [data, setData] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(false)

  const [cmd, setCmd] = useState<'echo' | 'ts-node' | 'node'>('echo')
  const [args, setArgs] = useState<string>('"Hello Strategist"')
  const [execResp, setExecResp] = useState<any>(null)
  const [execLoading, setExecLoading] = useState(false)

  const [csvUrl, setCsvUrl] = useState('')
  const [csvText, setCsvText] = useState('')
  const [ingestKey, setIngestKey] = useState('')
  const [ingestResp, setIngestResp] = useState<any>(null)
  const [ingestLoading, setIngestLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (token) setAccessToken(token)
    })
  }, [supabase])

  async function runChat() {
    try {
      setChatLoading(true)
      const resp = await strategistChat({ prompt: chatPrompt }, accessToken)
      setChatOutput(resp.output)
    } catch (e: any) {
      setChatOutput(`Error: ${e.message}`)
    } finally {
      setChatLoading(false)
    }
  }

  async function runQuery() {
    try {
      setDataLoading(true)
      const resp = await fetchReconciled(query, accessToken)
      setData(resp)
    } catch (e: any) {
      setData({ error: e.message })
    } finally {
      setDataLoading(false)
    }
  }

  async function runExec() {
    try {
      setExecLoading(true)
      const argv = args.trim() ? args.match(/(?:\"[^\"]*\"|[^\s])+/g)?.map(s => s.replace(/^\"|\"$/g, '')) || [] : []
      const resp = await strategistExec(cmd, argv, { dryRun: true }, accessToken)
      setExecResp(resp)
    } catch (e: any) {
      setExecResp({ error: e.message })
    } finally {
      setExecLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Facebook Strategist</h1>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 text-sm font-medium border ${activeTab==='chat'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'} rounded-l-lg`}>Chat</button>
          <button onClick={() => setActiveTab('reconciled')} className={`px-4 py-2 text-sm font-medium border -ml-px ${activeTab==='reconciled'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>Reconciled</button>
          <button onClick={() => setActiveTab('terminal')} className={`px-4 py-2 text-sm font-medium border -ml-px ${activeTab==='terminal'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'} rounded-r-lg`}>Terminal</button>
          <button onClick={() => setActiveTab('ingest')} className={`px-4 py-2 text-sm font-medium border -ml-px ${activeTab==='ingest'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'} rounded-r-lg`}>Ingest</button>
        </div>
      </div>

      {activeTab === 'chat' && (
        <div className="space-y-4">
          <textarea value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} className="w-full h-32 p-3 border rounded-md bg-white dark:bg-gray-900" />
          <div className="flex items-center gap-3">
            <button onClick={runChat} disabled={chatLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md">
              {chatLoading ? 'Thinking…' : 'Ask Strategist'}
            </button>
          </div>
          {chatOutput && (
            <pre className="whitespace-pre-wrap p-4 bg-gray-50 dark:bg-gray-900 border rounded-md text-sm">{chatOutput}</pre>
          )}
        </div>
      )}

      {activeTab === 'reconciled' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">Date</label>
              <input type="date" value={query.date || ''} onChange={(e) => setQuery({ ...query, date: e.target.value || undefined })} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-sm mb-1">Level</label>
              <select value={query.level || 'adset'} onChange={(e) => setQuery({ ...query, level: e.target.value as any })} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900">
                <option value="adset">Ad set</option>
                <option value="campaign">Campaign</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Account IDs (comma)</label>
              <input type="text" placeholder="act_123,act_456" value={query.account_ids || ''} onChange={(e) => setQuery({ ...query, account_ids: e.target.value || undefined })} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-sm mb-1">Owner</label>
              <input type="text" value={query.owner || ''} onChange={(e) => setQuery({ ...query, owner: e.target.value || undefined })} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-sm mb-1">Lane</label>
              <select value={query.lane || ''} onChange={(e) => setQuery({ ...query, lane: (e.target.value || undefined) as any })} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900">
                <option value="">Any</option>
                <option value="ASC">ASC</option>
                <option value="LAL_1">LAL_1</option>
                <option value="LAL_2_5">LAL_2_5</option>
                <option value="Contextual">Contextual</option>
                <option value="Sandbox">Sandbox</option>
                <option value="Warm">Warm</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Limit</label>
              <input type="number" value={query.limit || 50} onChange={(e) => setQuery({ ...query, limit: Number(e.target.value) })} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900" />
            </div>
          </div>
          <button onClick={runQuery} disabled={dataLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md">{dataLoading ? 'Loading…' : 'Fetch'}</button>
          {data && (
            <div className="overflow-auto border rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-900">
                  <tr>
                    {Object.keys((data.data?.[0] || {})).map((k) => (
                      <th key={k} className="text-left p-2 border-b">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.data || []).map((row: any, i: number) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-900">
                      {Object.keys(row).map((k) => (
                        <td key={k} className="p-2 border-b whitespace-nowrap">{String(row[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'terminal' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">Command</label>
              <select value={cmd} onChange={(e) => setCmd(e.target.value as any)} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900">
                <option value="echo">echo</option>
                <option value="ts-node">ts-node</option>
                <option value="node">node</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Args</label>
              <input type="text" value={args} onChange={(e) => setArgs(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900" />
              <p className="text-xs text-gray-500 mt-1">Examples: echo "Hello" | ts-node src/scripts/analyzePages.ts</p>
            </div>
          </div>
          <button onClick={runExec} disabled={execLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md">{execLoading ? 'Running…' : 'Run (dry-run)'}</button>
          {execResp && (
            <pre className="whitespace-pre-wrap p-4 bg-gray-50 dark:bg-gray-900 border rounded-md text-sm">{JSON.stringify(execResp, null, 2)}</pre>
          )}
        </div>
      )}

      {activeTab === 'ingest' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">CSV URL</label>
              <input type="text" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900" placeholder="https://...csv" />
            </div>
            <div>
              <label className="block text-sm mb-1">Storage Key (optional)</label>
              <input type="text" value={ingestKey} onChange={(e) => setIngestKey(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-gray-900" placeholder="default uses your user id" />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Or paste CSV</label>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full h-48 p-2 border rounded-md bg-white dark:bg-gray-900" placeholder="date,level,account_id,..." />
          </div>
          <button
            onClick={async () => {
              try {
                setIngestLoading(true)
                const resp = await strategistIngest({ csv: csvText || undefined, csv_url: csvUrl || undefined, key: ingestKey || undefined }, accessToken)
                setIngestResp(resp)
              } catch (e: any) {
                setIngestResp({ error: e.message })
              } finally {
                setIngestLoading(false)
              }
            }}
            disabled={ingestLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            {ingestLoading ? 'Ingesting…' : 'Ingest'}
          </button>
          {ingestResp && (
            <pre className="whitespace-pre-wrap p-4 bg-gray-50 dark:bg-gray-900 border rounded-md text-sm">{JSON.stringify(ingestResp, null, 2)}</pre>
          )}
          <p className="text-xs text-gray-500">After ingest, use the Reconciled tab and set the same key to filter your dataset.</p>
        </div>
      )}
    </div>
  )
}


