'use client'

import { useRouter } from 'next/navigation'
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
  const [switching, setSwitching] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSwitching(true)
    try {
      await fetch('/api/stores/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: e.target.value }),
      })
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <select
      aria-label="Switch store"
      value={currentStoreId ?? ''}
      onChange={handleChange}
      disabled={switching}
      className="rounded-md border border-gray-300 text-sm text-gray-700 py-1 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
    >
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  )
}
