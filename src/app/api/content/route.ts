import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError } from '@ledewire/node'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'

export async function GET(_request: NextRequest) {
  try {
    const { storeId } = await requireAuth()
    const client = await createMerchantClient()
    const items = await client.seller.content.list(storeId)
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

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, price_cents, content_body, visibility, content_type, content_uri, external_identifier } = body as {
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
    return NextResponse.json(
      { error: 'title and price_cents are required' },
      { status: 400 },
    )
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
    const { storeId } = await requireAuth()
    const client = await createMerchantClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkPayload: Record<string, any> = {
      content_type: type,
      title,
      price_cents,
      visibility: (visibility as 'public') ?? 'public',
    }
    if (type === 'external_ref') {
      sdkPayload.content_uri = content_uri
      if (external_identifier) sdkPayload.external_identifier = external_identifier
    } else {
      sdkPayload.content_body = content_body
    }
    const content = await client.seller.content.create(storeId, sdkPayload)

    return NextResponse.json({ ok: true, content }, { status: 201 })
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
