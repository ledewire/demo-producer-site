'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Store {
  id: string
  name: string
}

export default function StorePicker({ stores }: { stores: Store[] }) {
  const router = useRouter()
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (storeId: string) => {
    setSelecting(storeId)
    setError(null)
    try {
      const res = await fetch('/api/stores/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to select store')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSelecting(null)
    }
  }

  if (stores.length === 0) {
    return (
      <div className="rounded bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800 text-center">
        No stores are available for your account. Please contact support.
      </div>
    )
  }

  return (
    <div className="bg-white py-8 px-6 shadow rounded-lg space-y-4">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <ul className="space-y-3">
        {stores.map((store) => (
          <li key={store.id}>
            <button
              onClick={() => handleSelect(store.id)}
              disabled={selecting !== null}
              className="w-full flex items-center justify-between px-4 py-3 rounded-md border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
            >
              <span className="font-medium text-gray-900">{store.name}</span>
              {selecting === store.id ? (
                <span className="text-sm text-gray-500">Selecting…</span>
              ) : (
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
