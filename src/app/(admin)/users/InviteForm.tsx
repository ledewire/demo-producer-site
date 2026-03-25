'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InviteForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [feePct, setFeePct] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    let author_fee_bps: number | undefined
    if (feePct !== '') {
      const parsed = parseFloat(feePct)
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        setError('Fee must be a percentage between 0 and 100')
        setLoading(false)
        return
      }
      author_fee_bps = Math.round(parsed * 100)
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(author_fee_bps !== undefined ? { author_fee_bps } : {}),
        }),
      })
      const data = await res.json()
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
      } else {
        setSuccess(true)
        setEmail('')
        setFeePct('')
        // Refresh the server component to show the new user
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
          Invitation sent!
        </div>
      )}

      <div>
        <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="author@example.com"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="invite-fee" className="block text-sm font-medium text-gray-700">
          Author fee override <span className="font-normal text-gray-500">(optional, %)</span>
        </label>
        <div className="mt-1 flex items-center gap-1">
          <input
            id="invite-fee"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
            placeholder="e.g. 18"
            className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            aria-label="Author fee override percentage"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
        <p className="mt-1 text-xs text-gray-400">Leave blank to use the store default.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Sending…' : 'Send Invite'}
      </button>
    </form>
  )
}
