import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError } from '@ledewire/node'
import { requireAuth } from '@/lib/auth'
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
    const { storeId } = await requireAuth()
    const client = await createMerchantClient()
    const items = await client.seller.content.search(storeId, {
      metadata: metadata as Record<string, unknown>,
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (err instanceof LedewireError) {
      const e = err as LedewireError
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    throw err
  }
}
