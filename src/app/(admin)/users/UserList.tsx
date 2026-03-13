'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  role?: string | null
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

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {error && (
        <div className="px-6 pt-4 text-sm text-red-600">{error}</div>
      )}
      {users.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">No team members yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{user.email}</p>
                {user.role && (
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(user.id)}
                disabled={removing === user.id}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
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
