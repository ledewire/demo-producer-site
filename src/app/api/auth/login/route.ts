import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError, AuthError } from '@ledewire/node'
import type { TokenStorage, StoredTokens } from '@ledewire/node'
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

  // Capture the tokens the SDK writes after successful authentication.
  // We then persist them in the encrypted session cookie.
  let capturedTokens: StoredTokens | null = null
  const storage: TokenStorage = {
    async getTokens() {
      return capturedTokens
    },
    async setTokens(tokens: StoredTokens) {
      capturedTokens = tokens
    },
    async clearTokens() {
      capturedTokens = null
    },
  }

  const client = createClient({
    baseUrl: config.ledewireBaseUrl,
    storage,
  })

  try {
    await client.merchant.auth.loginWithEmail({ email, password })

    if (!capturedTokens) {
      return NextResponse.json(
        { error: 'Authentication succeeded but no token was returned' },
        { status: 500 },
      )
    }

    const stores = await client.merchant.auth.listStores()
    const storeId = stores[0]?.store_id ?? null

    session.accessToken = capturedTokens.accessToken
    session.refreshToken = capturedTokens.refreshToken
    session.expiresAt = capturedTokens.expiresAt
    session.storeId = storeId
    // Persist the full stores list so the store selector can show all options.
    session.stores = stores.map((s: { store_id: string }) => ({ store_id: s.store_id }))
    await session.save()

    return NextResponse.json({ ok: true, storeId })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    if (err instanceof LedewireError) {
      const e = err as LedewireError
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    throw err
  }
}
