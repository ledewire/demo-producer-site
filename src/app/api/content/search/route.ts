import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError, ForbiddenError } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { createMerchantClient } from '@/lib/ledewire'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { metadata } = body as { metadata?: unknown }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return NextResponse.json({ error: 'metadata object is required' }, { status: 400 })
  }

  try {
    const session = await getSession()
    if (!session.accessToken || !session.storeId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { storeId } = session
    const client = await createMerchantClient()
    const { data } = await client.seller.content.search(storeId, {
      metadata: metadata as Record<string, unknown>,
    })
    return NextResponse.json({ items: data })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}
