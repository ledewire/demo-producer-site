import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import StorePicker from './StorePicker'

export const metadata = { title: 'Select Store — LedeWire Producer' }

export default async function SelectStorePage() {
  const session = await getSession()

  if (!session.accessToken) {
    redirect('/login')
  }

  // If a store is already active (e.g. single-store merchant or already picked),
  // skip the picker and go straight to the dashboard.
  if (session.storeId) {
    redirect('/dashboard')
  }

  const stores = session.stores ?? []

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Select Your Store</h1>
          <p className="mt-2 text-sm text-gray-600">
            You have access to multiple stores. Choose one to continue.
          </p>
        </div>
        <StorePicker stores={stores} />
      </div>
    </div>
  )
}
