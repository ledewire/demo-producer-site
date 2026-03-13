import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'
import { LedewireError, AuthError, NotFoundError } from '@ledewire/node'
import EditContentForm from './EditContentForm'

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { storeId } = await requireAuth()

  try {
    const client = await createMerchantClient()
    const item = await client.seller.content.get(storeId, id)

    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Content</h1>
        <EditContentForm id={id} item={item} />
      </div>
    )
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof NotFoundError) redirect('/content')
    if (err instanceof LedewireError) {
      const e = err as LedewireError
      return <p className="text-red-600 text-sm">API error: {e.message}</p>
    }
    throw err
  }
}
