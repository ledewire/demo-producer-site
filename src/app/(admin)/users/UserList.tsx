'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string | null
  role?: string | null
  author_fee_bps: number | null
  invited_at: string | null
  accepted_at: string | null
}

function formatFee(bps: number | null): string {
  if (bps === null) return 'Store default'
  return `${(bps / 100).toFixed(2).replace(/\.00$/, '')}%`
}

function FeeEditor({
  userId,
  currentBps,
  onSaved,
}: {
  userId: string
  currentBps: number | null
  onSaved: (newBps: number | null) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pct, setPct] = useState(currentBps !== null ? String(currentBps / 100) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (bps: number | null) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_fee_bps: bps }),
      })
      const data = await res.json()
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Failed to update fee')
      } else {
        onSaved(bps)
        setEditing(false)
        setPct(bps !== null ? String(bps / 100) : '')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    const parsed = parseFloat(pct)
    if (pct === '' || isNaN(parsed) || parsed < 0 || parsed > 100) {
      setError('Enter a percentage between 0 and 100')
      return
    }
    submit(Math.round(parsed * 100))
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">{formatFee(currentBps)}</span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-indigo-500 hover:text-indigo-700"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          placeholder="e.g. 18"
          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          aria-label="Author fee percentage"
        />
        <span className="text-sm text-gray-500">%</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => submit(null)}
          disabled={saving}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          title="Revert to store default"
        >
          Default
        </button>
        <button
          onClick={() => {
            setEditing(false)
            setError(null)
          }}
          disabled={saving}
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function UserList({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this author from your store?')) return
    setRemoving(userId)
    setError(null)
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Failed to remove user')
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
      }
    } finally {
      setRemoving(null)
    }
  }

  const handleFeeSaved = (userId: string, newBps: number | null) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, author_fee_bps: newBps } : u)))
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {error && <div className="px-6 pt-4 text-sm text-red-600">{error}</div>}
      {users.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">No team members yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between px-6 py-4 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{user.email ?? '(no email)'}</p>
                  {user.invited_at && !user.accepted_at && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      Pending
                    </span>
                  )}
                </div>
                {user.role && <p className="text-xs text-gray-500 capitalize">{user.role}</p>}
              </div>
              {user.role !== 'owner' && (
                <div className="shrink-0">
                  <FeeEditor
                    userId={user.id}
                    currentBps={user.author_fee_bps}
                    onSaved={(bps) => handleFeeSaved(user.id, bps)}
                  />
                </div>
              )}
              <button
                onClick={() => handleRemove(user.id)}
                disabled={removing === user.id}
                className="shrink-0 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                {removing === user.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
