import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'
import { LedewireError, AuthError } from '@ledewire/node'
import SalesTable from './SalesTable'

export default async function DashboardPage() {
  const { storeId } = await requireAuth()

  try {
    const client = await createMerchantClient()
    const [summary, { data: recentSales }] = await Promise.all([
      client.merchant.sales.summary(storeId),
      client.merchant.sales.list(storeId),
    ])

    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <StatCard
            label="Total Revenue"
            value={`$${(summary.total_revenue_cents / 100).toFixed(2)}`}
          />
          <StatCard label="Total Sales" value={String(summary.total_sales)} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Sales</h2>
          <SalesTable sales={recentSales} />
        </div>
      </div>
    )
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-1">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}
