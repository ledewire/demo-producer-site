import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'
import { LedewireError, AuthError } from '@ledewire/node'
import UserList from './UserList'
import InviteForm from './InviteForm'

export default async function UsersPage() {
  const { storeId } = await requireAuth()

  let users: Awaited<
    ReturnType<Awaited<ReturnType<typeof createMerchantClient>>['merchant']['users']['list']>
  >

  try {
    const client = await createMerchantClient()
    users = await client.merchant.users.list(storeId)
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      const e = err as LedewireError
      return <p className="text-red-600 text-sm">API error: {e.message}</p>
    }
    throw err
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Authors</h1>
      <UserList initialUsers={users} />
      <div className="max-w-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Invite Author</h2>
        <InviteForm />
      </div>
    </div>
  )
}
