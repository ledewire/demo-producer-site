import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, AuthError, ForbiddenError } from '@ledewire/node'
import { createMerchantClient } from '@/lib/ledewire'
import { requireAuthForRoute } from '@/lib/route-auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { domainId } = await params
  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    await client.merchant.domains.remove(storeId, domainId)
    return new NextResponse(null, { status: 204 })
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
