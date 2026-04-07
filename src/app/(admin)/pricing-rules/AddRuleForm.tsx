'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MerchantDomainVerification } from '@/lib/content'

interface Props {
  verifiedDomains: MerchantDomainVerification[]
}

export default function AddRuleForm({ verifiedDomains }: Props) {
  const router = useRouter()
  const [urlPattern, setUrlPattern] = useState('')
  const [priceDollars, setPriceDollars] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!urlPattern) {
      setError('URL pattern is required')
      return
    }
    if (!/^https?:\/\//.test(urlPattern)) {
      setError('URL pattern must start with http:// or https://')
      return
    }

    const parsedPrice = parseFloat(priceDollars)
    if (priceDollars === '' || isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a non-negative number')
      return
    }
    const price_cents = Math.round(parsedPrice * 100)

    setLoading(true)
    try {
      const res = await fetch('/api/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_pattern: urlPattern, price_cents }),
      })
      const data = await res.json()
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Failed to create rule')
      } else {
        setSuccess(true)
        setUrlPattern('')
        setPriceDollars('')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
    >
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Pricing rule created!
        </div>
      )}

      {verifiedDomains.length === 0 && (
        <div className="rounded bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
          You must verify at least one domain before creating pricing rules.
        </div>
      )}

      <div>
        <label htmlFor="rule-pattern" className="block text-sm font-medium text-gray-700">
          URL pattern
        </label>
        <input
          id="rule-pattern"
          type="text"
          required
          value={urlPattern}
          onChange={(e) => setUrlPattern(e.target.value)}
          placeholder="https://example.com/articles/*"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-400">
          Supports <code>*</code> (single segment) and <code>**</code> (cross-separator) wildcards.
          Domain must be verified below.
        </p>
      </div>

      <div>
        <label htmlFor="rule-price" className="block text-sm font-medium text-gray-700">
          Price (USD)
        </label>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-sm text-gray-500">$</span>
          <input
            id="rule-price"
            type="number"
            min={0}
            step={0.01}
            required
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="1.50"
            className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Enter 0 to make matching URLs freely accessible.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || verifiedDomains.length === 0}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating…' : 'Create Rule'}
      </button>
    </form>
  )
}
