import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError, ForbiddenError, NotFoundError } from '@ledewire/node'
import { createMerchantClient } from '@/lib/ledewire'
import { requireAuthForRoute } from '@/lib/route-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const { contentId } = await params

  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    const item = await client.seller.content.get(storeId, contentId)
    return NextResponse.json({ item })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const { contentId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    title,
    price_cents,
    content_body,
    visibility,
    content_uri,
    external_identifier,
    content_type,
  } = body as {
    title?: string
    price_cents?: number
    content_body?: string
    visibility?: string
    content_uri?: string
    external_identifier?: string
    content_type?: string
  }

  // Build a patch with only the fields that were provided
  const patch: Record<string, unknown> = {}
  if (title !== undefined) patch.title = title
  if (price_cents !== undefined) patch.price_cents = price_cents
  if (content_body !== undefined) patch.content_body = content_body
  if (visibility !== undefined) patch.visibility = visibility
  if (content_uri !== undefined) patch.content_uri = content_uri
  if (external_identifier !== undefined) patch.external_identifier = external_identifier
  if (content_type !== undefined) patch.content_type = content_type

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (price_cents !== undefined && (!Number.isInteger(price_cents) || price_cents < 0)) {
    return NextResponse.json({ error: 'price_cents must be a non-negative integer' }, { status: 400 })
  }

  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    const updated = await client.seller.content.update(storeId, contentId, patch)
    return NextResponse.json({ ok: true, content: updated })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const { contentId } = await params

  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    await client.seller.content.delete(storeId, contentId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}
