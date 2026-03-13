'use client'

import { useState } from 'react'
import Pagination from '@/components/Pagination'

interface Sale {
  title: string
  total_revenue_cents: number
}

interface Props {
  sales: Sale[]
}

const PAGE_SIZE = 10

export default function SalesTable({ sales }: Props) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE))
  const visible = sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (sales.length === 0) {
    return <p className="text-gray-500 text-sm">No sales yet.</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Content</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visible.map((sale, i) => (
              <tr key={i}>
                <td className="px-4 py-2 text-gray-900">{sale.title}</td>
                <td className="px-4 py-2 text-right font-mono">
                  ${(sale.total_revenue_cents / 100).toFixed(2)}
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
