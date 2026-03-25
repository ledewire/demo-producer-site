'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface Store {
  id: string
  name: string
}

interface Props {
  stores: Store[]
  currentStoreId: string | null
}

export default function StoreSelector({ stores, currentStoreId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSwitching(true)
    setError(null)
    try {
      const res = await fetch('/api/stores/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: e.target.value }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to switch store')
        return
      }
      // Navigate to the current path — triggers a full server re-render
      // including layouts, ensuring NavBar and page data both reflect the
      // new store. router.refresh() does not reliably re-render shared layouts.
      router.push(pathname)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        aria-label="Switch store"
        value={currentStoreId ?? ''}
        onChange={handleChange}
        disabled={switching}
        className="min-w-[12rem] rounded-md border border-gray-300 text-sm text-gray-700 py-1 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
