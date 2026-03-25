import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError } from '@ledewire/node'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { author_fee_bps } = body as { author_fee_bps?: number | null }

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

    const updated = await client.merchant.users.update(storeId, userId, {
      author_fee_bps: author_fee_bps ?? null,
    })

    return NextResponse.json({ ok: true, user: updated })
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params

  try {
    const { storeId } = await requireAuth()
    const client = await createMerchantClient()

    await client.merchant.users.remove(storeId, userId)

    return NextResponse.json({ ok: true })
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
