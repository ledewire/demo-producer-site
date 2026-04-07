import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'
import { LedewireError, AuthError } from '@ledewire/node'
import UserList from './UserList'
import InviteForm from './InviteForm'

export default async function UsersPage() {
  const { storeId } = await requireAuth()

  try {
    const client = await createMerchantClient()
    const { data: users } = await client.merchant.users.list(storeId)

    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Authors</h1>
        <UserList initialUsers={users} />
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Invite Author</h2>
          <InviteForm />
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
