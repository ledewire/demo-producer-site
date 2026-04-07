'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MerchantPricingRule } from '@/lib/content'

interface Props {
  initialRules: MerchantPricingRule[]
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function PricingRulesTable({ initialRules }: Props) {
  const router = useRouter()
  const [rules, setRules] = useState(initialRules)
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeRules = rules.filter((r) => r.active)

  const handleDeactivate = async (ruleId: string) => {
    setDeactivating(ruleId)
    setError(null)
    try {
      const res = await fetch(`/api/pricing-rules/${ruleId}`, { method: 'DELETE' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to deactivate rule')
      } else {
        setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, active: false } : r)))
      }
    } finally {
      setDeactivating(null)
    }
  }

  if (activeRules.length === 0) {
    return <p className="text-sm text-gray-500">No active pricing rules.</p>
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">URL Pattern</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Price</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {activeRules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-4 py-3 font-mono text-gray-800 break-all">{rule.url_pattern}</td>
                <td className="px-4 py-3 text-gray-800">{formatPrice(rule.price_cents)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(rule.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDeactivate(rule.id)}
                    disabled={deactivating === rule.id}
                    className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating === rule.id ? 'Deactivating…' : 'Deactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
