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

  const { domain } = body as { domain?: string }

  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  const auth = await requireAuthForRoute()
  if (auth instanceof NextResponse) return auth
  const { storeId } = auth
  try {
    const client = await createMerchantClient()
    const result = await client.merchant.domains.verify(storeId, { domain })
    return NextResponse.json(result, { status: 202 })
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
