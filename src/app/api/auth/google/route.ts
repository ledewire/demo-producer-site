import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError, AuthError, ForbiddenError } from '@ledewire/node'
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
  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  try {
    const { tokens, stores } = await client.merchant.auth.loginWithGoogleAndListStores({ id_token })

    session.accessToken = tokens.accessToken
    session.refreshToken = tokens.refreshToken
    session.expiresAt = tokens.expiresAt
    // Auto-select only when there is exactly one store; for multiple stores
    // the client will redirect to /select-store so the user can choose.
    session.storeId = stores.length === 1 ? stores[0].id : null
    session.stores = stores.map((s) => ({ id: s.id, name: s.name }))
    await session.save()

    console.log('[auth/google] login succeeded', {
      storeId: session.storeId,
      storeCount: stores.length,
    })
    return NextResponse.json({
      ok: true,
      storeId: session.storeId,
      requiresStoreSelection: stores.length > 1,
    })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      console.error('[auth/google] ForbiddenError', { message: err.message })
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof AuthError) {
      console.error('[auth/google] AuthError', { message: err.message, statusCode: err.statusCode })
      return NextResponse.json({ error: 'Google authentication failed' }, { status: 401 })
    }
    if (err instanceof LedewireError) {
      console.error('[auth/google] LedewireError', {
        message: err.message,
        statusCode: err.statusCode,
      })
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[auth/google] unexpected error', err)
    throw err
  }
}
