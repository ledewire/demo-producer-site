import { redirect } from 'next/navigation'
import { getSession } from './session'

/**
 * Guards a Server Component or Route Handler.
 *
 * Reads the encrypted session cookie and redirects to /login when the user
 * is not authenticated or when no store is associated with the session.
 *
 * Returns the storeId required for all merchant API calls.
 */
export async function requireAuth(): Promise<{ storeId: string }> {
  const session = await getSession()
  if (!session.accessToken) {
    redirect('/login')
  }
  if (!session.storeId) {
    // Authenticated but no store selected — send to the store picker.
    redirect('/select-store')
  }
  return { storeId: session.storeId }
}
