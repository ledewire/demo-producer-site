'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 10

interface ContentItem {
  id: string
  title: string
  content_type: string
  content_uri?: string | null
  price_cents: number
  visibility: string
  created_at: string
}

interface Props {
  initialItems: ContentItem[]
}

export default function ContentTable({ initialItems }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const filtered = query
    ? items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
    : items
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setPage(1)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return

    setDeletingId(id)
    setError(null)

    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to delete content')
      } else {
        setItems((prev) => prev.filter((item) => item.id !== id))
        // Stay on the current page unless it no longer exists after deletion
        setPage((p) => Math.min(p, Math.max(1, Math.ceil((items.length - 1) / PAGE_SIZE))))
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={handleQueryChange}
        placeholder="Search by title…"
        aria-label="Search content"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {error && (
        <div
          role="alert"
          className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Price</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Visibility</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visibleItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{item.content_type}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  ${(item.price_cents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.visibility === 'public'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.visibility}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  {item.content_uri && (
                    <a
                      href={item.content_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                      View ↗
                    </a>
                  )}
                  <Link
                    href={`/content/${item.id}/edit`}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    disabled={deletingId === item.id}
                    aria-label={`Delete ${item.title}`}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                  >
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  )
}
