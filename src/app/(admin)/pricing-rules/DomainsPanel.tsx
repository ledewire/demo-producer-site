'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MerchantDomainVerification } from '@/lib/content'

interface Props {
  initialDomains: MerchantDomainVerification[]
}

const STATUS_CLASS: Record<MerchantDomainVerification['status'], string> = {
  verified: 'text-green-600 font-medium',
  pending: 'text-yellow-600',
  failed: 'text-red-600',
}

export default function DomainsPanel({ initialDomains }: Props) {
  const router = useRouter()
  const [domains, setDomains] = useState(initialDomains)
  const [domainInput, setDomainInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null)

  const handleVerify = async (domain: string) => {
    setVerifyingDomain(domain)
    setError(null)
    try {
      const res = await fetch('/api/domains/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to trigger verification')
        return
      }
      // Job enqueued — immediately refresh the list to pick up any instant transition
      await handleRefresh()
    } finally {
      setVerifyingDomain(null)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/domains')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to refresh domain statuses')
      } else {
        const data = await res.json()
        setDomains(data.domains)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = domainInput.trim()
    if (!trimmed) {
      setAddError('Domain is required')
      return
    }
    setAddError(null)
    setAdding(true)
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: trimmed }),
      })
      const data = await res.json()
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setAddError(data.error ?? 'Failed to add domain')
      } else {
        setDomains((prev) => [...prev, data.domain])
        setDomainInput('')
        setExpandedId(data.domain.id)
      }
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (domainId: string) => {
    setRemovingId(domainId)
    setError(null)
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: 'DELETE' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to remove domain')
      } else {
        setDomains((prev) => prev.filter((d) => d.id !== domainId))
        if (expandedId === domainId) setExpandedId(null)
      }
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Domain list */}
      {domains.length === 0 ? (
        <p className="text-sm text-gray-500">No domains added yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white text-sm">
            {domains.map((d) => (
              <li key={d.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-800">{d.domain}</span>
                    <span className={STATUS_CLASS[d.status]}>{d.status}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {d.status !== 'verified' && (
                      <>
                        <button
                          onClick={() => handleVerify(d.domain)}
                          disabled={verifyingDomain === d.domain || refreshing}
                          className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {verifyingDomain === d.domain ? 'Checking…' : 'Check Now'}
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                          className="text-xs text-indigo-500 hover:text-indigo-700"
                        >
                          {expandedId === d.id ? 'Hide DNS' : 'Show DNS'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleRemove(d.id)}
                      disabled={removingId === d.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {removingId === d.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>

                {/* DNS instructions (expanded) */}
                {expandedId === d.id && (
                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 space-y-2 text-xs text-gray-700">
                    <p>
                      Add the following DNS TXT record to verify ownership of{' '}
                      <strong>{d.domain}</strong>. Verification runs automatically once the record
                      propagates (typically within 1 hour).
                    </p>
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono">
                      <span className="text-gray-500">Name</span>
                      <span className="break-all select-all">{d.txt_record_name}</span>
                      <span className="text-gray-500">Value</span>
                      <span className="break-all select-all">{d.txt_record_value}</span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? 'Checking…' : 'Refresh Status'}
          </button>
        </>
      )}

      {/* Add domain form */}
      <form noValidate onSubmit={handleAdd} className="flex items-start gap-2">
        <div className="flex-1">
          <input
            id="add-domain"
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="example.com"
            aria-label="Domain name"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {addError && <p className="mt-1 text-xs text-red-600">{addError}</p>}
        </div>
        <button
          type="submit"
          disabled={adding}
          className="flex-shrink-0 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? 'Adding…' : 'Add Domain'}
        </button>
      </form>
    </div>
  )
}
