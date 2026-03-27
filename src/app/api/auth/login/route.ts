import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError, AuthError, ForbiddenError } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { config } from '@/lib/config'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, password } = body as { email?: string; password?: string }
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
  }

  const session = await getSession()
  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  try {
    const { tokens, stores } = await client.merchant.auth.loginWithEmailAndListStores({
      email,
      password,
    })

    session.accessToken = tokens.accessToken
    session.refreshToken = tokens.refreshToken
    session.expiresAt = tokens.expiresAt
    // Auto-select only when there is exactly one store; for multiple stores
    // the client will redirect to /select-store so the user can choose.
    session.storeId = stores.length === 1 ? stores[0].id : null
    // Persist the full stores list so the store selector can show all options.
    session.stores = stores.map((s) => ({ id: s.id, name: s.name, role: s.role }))
    await session.save()

    return NextResponse.json({
      ok: true,
      storeId: session.storeId,
      requiresStoreSelection: stores.length > 1,
    })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}
