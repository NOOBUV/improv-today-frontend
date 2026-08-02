'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEV_AUTH_BYPASS } from '@/components/shared/AuthProvider';

interface LogRow {
  id: number;
  conversation_id: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  created_at: string | null;
}

function metaLine(meta: LogRow['meta']): string | null {
  if (!meta) return null;
  const bits: string[] = [];
  if (meta.conversation_emotion) bits.push(`emotion: ${meta.conversation_emotion}`);
  if (meta.fallback_mode) bits.push('fallback');
  if (meta.correlation_id) bits.push(String(meta.correlation_id));
  return bits.length ? bits.join(' · ') : null;
}

export default function TranscriptsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/backend/clara/conversation/log?limit=200');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setRows(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (DEV_AUTH_BYPASS) load();
  }, [load]);

  if (!DEV_AUTH_BYPASS) {
    return <div className="p-8 text-gray-500">Not available outside development.</div>;
  }

  // Newest first from the API; group by conversation, keeping that order.
  const groups = new Map<string, LogRow[]>();
  for (const row of rows) {
    const list = groups.get(row.conversation_id) ?? [];
    list.push(row);
    groups.set(row.conversation_id, list);
  }

  return (
    <div className="min-h-screen bg-rose-50/40 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Conversation transcripts</h1>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-full bg-white px-4 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">Failed to load: {error}</p>}
        {!error && rows.length === 0 && !loading && (
          <p className="text-sm text-gray-500">No turns logged yet.</p>
        )}

        {[...groups.entries()].map(([conversationId, turns]) => (
          <section key={conversationId} className="mb-8">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-gray-400">
              {conversationId} · {turns.length} turns
            </h2>
            <div className="space-y-2">
              {turns.map((turn) => {
                const meta = metaLine(turn.meta);
                return (
                  <div key={turn.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          turn.role === 'user'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {turn.role === 'user' ? 'You' : 'Clara'}
                      </span>
                      <span className="text-gray-400">
                        {turn.created_at ? new Date(turn.created_at).toLocaleString() : '—'}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-800">{turn.content}</p>
                    {meta && <p className="mt-2 text-xs text-gray-400">{meta}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
