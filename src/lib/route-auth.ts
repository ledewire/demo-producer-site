import { NextResponse } from 'next/server'
import { getSession } from './session'

/**
 * Guards a Route Handler.
 *
 * Returns `{ storeId }` when the session is valid, or a 401 NextResponse
 * when the session is missing or has no store selected.
 *
 * Use in Route Handlers only — Server Components should use `requireAuth()`
 * from `./auth` instead.
 */
export async function requireAuthForRoute(): Promise<{ storeId: string } | NextResponse> {
  const session = await getSession()
  if (!session.accessToken || !session.storeId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return { storeId: session.storeId }
}
