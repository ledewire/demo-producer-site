import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'
import { LedewireError, AuthError } from '@ledewire/node'
import ContentTable from './ContentTable'

export default async function ContentListPage() {
  const { storeId } = await requireAuth()

  try {
    const client = await createMerchantClient()
    const { data: items } = await client.seller.content.list(storeId)

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Content</h1>
          <Link
            href="/content/new"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            New content
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
            <p className="text-sm text-gray-500">No content yet.</p>
            <Link
              href="/content/new"
              className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
            >
              Create your first piece of content →
            </Link>
          </div>
        ) : (
          <ContentTable initialItems={items} />
        )}
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
