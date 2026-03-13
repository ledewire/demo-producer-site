import Link from 'next/link'
import LogoutButton from './LogoutButton'
import StoreSelector from './StoreSelector'
import { getSession } from '@/lib/session'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/content', label: 'Content' },
  { href: '/users', label: 'Authors' },
]

export default async function NavBar() {
  const session = await getSession()
  const stores = session.stores ?? []
  const currentStoreId = session.storeId ?? null

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <span className="font-bold text-indigo-700 text-lg">LedeWire</span>
            <div className="hidden sm:flex space-x-6">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {stores.length > 1 && (
              <StoreSelector stores={stores} currentStoreId={currentStoreId} />
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  )
}
