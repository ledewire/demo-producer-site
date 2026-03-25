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

  const { email, author_fee_bps } = body as { email?: string; author_fee_bps?: number | null }
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  if (author_fee_bps !== null && author_fee_bps !== undefined) {
    if (!Number.isInteger(author_fee_bps) || author_fee_bps < 0 || author_fee_bps > 10000) {
      return NextResponse.json(
        { error: 'author_fee_bps must be an integer between 0 and 10000, or null' },
        { status: 400 },
      )
    }
  }

  try {
    const { storeId } = await requireAuth()
    const client = await createMerchantClient()

    await client.merchant.users.invite(storeId, {
      email,
      ...(author_fee_bps !== undefined ? { author_fee_bps } : {}),
    })

    return NextResponse.json({ ok: true }, { status: 201 })
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
