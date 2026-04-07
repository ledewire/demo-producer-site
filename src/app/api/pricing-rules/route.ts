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
    const rules = await client.merchant.pricingRules.list(storeId)
    return NextResponse.json({ rules })
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

  const { url_pattern, price_cents } = body as { url_pattern?: string; price_cents?: number }

  if (!url_pattern) {
    return NextResponse.json({ error: 'url_pattern is required' }, { status: 400 })
  }
  if (!/^https?:\/\//.test(url_pattern)) {
    return NextResponse.json(
      { error: 'url_pattern must start with http:// or https://' },
      { status: 400 },
    )
  }
  if (price_cents == null) {
    return NextResponse.json({ error: 'price_cents is required' }, { status: 400 })
  }
  if (!Number.isInteger(price_cents) || price_cents < 0) {
    return NextResponse.json(
      { error: 'price_cents must be a non-negative integer' },
      { status: 400 },
    )
  }

  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    const rule = await client.merchant.pricingRules.create(storeId, { url_pattern, price_cents })
    return NextResponse.json({ rule }, { status: 201 })
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
