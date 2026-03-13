import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = await getSession()

  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { storeId } = body as { storeId?: string }
  if (!storeId) {
    return NextResponse.json({ error: 'storeId is required' }, { status: 400 })
  }

  // Only allow stores that were listed at login time — prevents arbitrary
  // storeId injection that could access another merchant's data.
  const knownStores = session.stores ?? []
  const isValid = knownStores.some((s) => s.store_id === storeId)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid store' }, { status: 400 })
  }

  session.storeId = storeId
  await session.save()

  return NextResponse.json({ ok: true })
}
