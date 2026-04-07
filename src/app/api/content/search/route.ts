import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError, ForbiddenError } from '@ledewire/node'
import { createMerchantClient } from '@/lib/ledewire'
import { requireAuthForRoute } from '@/lib/route-auth'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, metadata } = body as { title?: unknown; metadata?: unknown }

  if (!title && !metadata) {
    return NextResponse.json({ error: 'title or metadata is required' }, { status: 400 })
  }
  if (title !== undefined && typeof title !== 'string') {
    return NextResponse.json({ error: 'title must be a string' }, { status: 400 })
  }
  if (metadata !== undefined && (typeof metadata !== 'object' || Array.isArray(metadata) || metadata === null)) {
    return NextResponse.json({ error: 'metadata must be an object' }, { status: 400 })
  }

  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    const { data } = await client.seller.content.search(storeId, {
      ...(title ? { title: title as string } : {}),
      ...(metadata ? { metadata: metadata as Record<string, unknown> } : {}),
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
