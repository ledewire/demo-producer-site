'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MarkdownEditor from '@/components/MarkdownEditor'
import { VISIBILITY_OPTIONS, CONTENT_TYPE_OPTIONS } from '@/lib/content'

export default function NewContentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contentType, setContentType] = useState<'markdown' | 'external_ref'>('markdown')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const title = form.get('title') as string
    const priceDollars = form.get('price') as string
    const visibility = form.get('visibility') as string

    const priceCents = Math.round(parseFloat(priceDollars) * 100)
    if (isNaN(priceCents) || priceCents < 0) {
      setError('Price must be a valid non-negative number')
      setLoading(false)
      return
    }

    const payload: Record<string, unknown> = {
      title,
      price_cents: priceCents,
      visibility,
      content_type: contentType,
    }

    if (contentType === 'markdown') {
      const contentBody = form.get('content_body') as string
      const encBytes = new TextEncoder().encode(contentBody)
      const encBinary = Array.from(encBytes, (b) => String.fromCharCode(b)).join('')
      payload.content_body = btoa(encBinary)
    } else {
      payload.content_uri = form.get('content_uri') as string
      const externalId = form.get('external_identifier') as string
      if (externalId) payload.external_identifier = externalId
    }

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create content')
      } else {
        router.push('/content')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Content</h1>

      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        {error && (
          <div role="alert" className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="content_type" className="block text-sm font-medium text-gray-700">
            Content type
          </label>
          <select
            id="content_type"
            name="content_type"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as 'markdown' | 'external_ref')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {CONTENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
            Price (USD)
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue="2.99"
              className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="public"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {contentType === 'markdown' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Content (Markdown)
            </label>
            <div className="mt-1">
              <MarkdownEditor id="content_body" required />
            </div>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="content_uri" className="block text-sm font-medium text-gray-700">
                Content URI
              </label>
              <input
                id="content_uri"
                name="content_uri"
                type="url"
                required
                placeholder="https://vimeo.com/987654321"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">The URL of the externally hosted resource (video, PDF, etc.)</p>
            </div>
            <div>
              <label htmlFor="external_identifier" className="block text-sm font-medium text-gray-700">
                External identifier <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="external_identifier"
                name="external_identifier"
                type="text"
                placeholder="vimeo:987654321"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Provider-prefixed ID, e.g. <code>vimeo:987654321</code></p>
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>
    </div>
  )
}
