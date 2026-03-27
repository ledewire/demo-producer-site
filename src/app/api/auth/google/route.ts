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

  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  // Defence-in-depth: validate the token audience before passing to the SDK.
  // The expected client ID is fetched from the API's public config (no env var
  // needed). If the fetch fails we skip the check — the SDK itself validates
  // the token with Google's servers before accepting it.
  try {
    const { google_client_id } = await client.config.getPublic()
    if (google_client_id) {
      const audience = extractJwtAudience(id_token)
      if (audience !== google_client_id) {
        return NextResponse.json({ error: 'Invalid token audience' }, { status: 400 })
      }
    }
  } catch {
    // Public config unavailable — proceed; the SDK will reject invalid tokens.
  }

  const session = await getSession()

  try {
    const { tokens, stores } = await client.merchant.auth.loginWithGoogleAndListStores({ id_token })

    session.accessToken = tokens.accessToken
    session.refreshToken = tokens.refreshToken
    session.expiresAt = tokens.expiresAt
    // Auto-select only when there is exactly one store; for multiple stores
    // the client will redirect to /select-store so the user can choose.
    session.storeId = stores.length === 1 ? stores[0].id : null
    session.stores = stores.map((s) => ({ id: s.id, name: s.name, role: s.role }))
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
