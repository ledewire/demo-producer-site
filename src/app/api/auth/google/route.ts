import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError, AuthError } from '@ledewire/node'
import type { TokenStorage, StoredTokens } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { config } from '@/lib/config'

/**
 * Decodes the payload of a JWT and returns the `aud` (audience) claim.
 * This is a defence-in-depth check — the SDK performs the full signature
 * verification against Google's servers.
 */
function extractJwtAudience(token: string): string | null {
  try {
    const payloadB64 = token.split('.')[1]
    if (!payloadB64) return null
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
    return typeof payload.aud === 'string' ? payload.aud : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id_token } = body as { id_token?: string }
  if (!id_token) {
    return NextResponse.json({ error: 'id_token is required' }, { status: 400 })
  }

  // Validate that the token was issued for our Google Client ID before
  // passing it to the SDK. Prevents cross-app token reuse.
  const expectedAudience = config.googleClientId
  if (expectedAudience) {
    const audience = extractJwtAudience(id_token)
    if (audience !== expectedAudience) {
      return NextResponse.json({ error: 'Invalid token audience' }, { status: 400 })
    }
  }

  const session = await getSession()

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
    await client.merchant.auth.loginWithGoogle({ id_token })

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
    session.stores = stores.map((s: { store_id: string }) => ({ store_id: s.store_id }))
    await session.save()

    console.log('[auth/google] login succeeded', { storeId, storeCount: stores.length })
    return NextResponse.json({ ok: true, storeId })
  } catch (err) {
    if (err instanceof AuthError) {
      console.error('[auth/google] AuthError', {
        message: (err as AuthError).message,
        statusCode: (err as AuthError).statusCode,
        raw: err,
      })
      return NextResponse.json({ error: 'Google authentication failed' }, { status: 401 })
    }
    if (err instanceof LedewireError) {
      const e = err as LedewireError
      console.error('[auth/google] LedewireError', {
        message: e.message,
        statusCode: e.statusCode,
        raw: err,
      })
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    console.error('[auth/google] unexpected error', err)
    throw err
  }
}
