import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError } from '@ledewire/node'
import { requireAuth } from '@/lib/auth'
import { createMerchantClient } from '@/lib/ledewire'

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
      const e = err as LedewireError
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    throw err
  }
}
