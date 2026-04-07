import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError, ForbiddenError } from '@ledewire/node'
import { createMerchantClient } from '@/lib/ledewire'
import { requireAuthForRoute } from '@/lib/route-auth'

export async function GET(_request: NextRequest) {
  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    const { data } = await client.seller.content.list(storeId)
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

export async function POST(request: NextRequest) {
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
    content_type,
    content_uri,
    external_identifier,
  } = body as {
    title?: string
    price_cents?: number
    content_body?: string
    visibility?: string
    content_type?: string
    content_uri?: string
    external_identifier?: string
  }

  const type = content_type ?? 'markdown'

  if (!title || price_cents == null) {
    return NextResponse.json({ error: 'title and price_cents are required' }, { status: 400 })
  }

  if (!Number.isInteger(price_cents) || price_cents < 0) {
    return NextResponse.json({ error: 'price_cents must be a non-negative integer' }, { status: 400 })
  }

  if (type === 'external_ref') {
    if (!content_uri) {
      return NextResponse.json(
        { error: 'content_uri is required for external_ref content' },
        { status: 400 },
      )
    }
  } else if (!content_body) {
    return NextResponse.json(
      { error: 'content_body is required for markdown content' },
      { status: 400 },
    )
  }

  try {
    const auth = await requireAuthForRoute()
    if (auth instanceof NextResponse) return auth
    const { storeId } = auth
    const client = await createMerchantClient()

    const sdkPayload =
      type === 'external_ref'
        ? {
            content_type: 'external_ref' as const,
            title: title!,
            content_uri: content_uri!,
            ...(external_identifier ? { external_identifier } : {}),
            price_cents: price_cents!,
            visibility: (visibility as 'public' | 'unlisted') ?? 'public',
          }
        : {
            content_type: 'markdown' as const,
            title: title!,
            content_body: content_body!,
            price_cents: price_cents!,
            visibility: (visibility as 'public' | 'unlisted') ?? 'public',
          }

    const content = await client.seller.content.create(storeId, sdkPayload)

    return NextResponse.json({ ok: true, content }, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}
