import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError } from '@ledewire/node'
import { config } from '@/lib/config'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, reset_code, password } = body as {
    email?: string
    reset_code?: string
    password?: string
  }
  if (!email || !reset_code || !password) {
    return NextResponse.json(
      { error: 'email, reset_code, and password are required' },
      { status: 400 },
    )
  }

  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  try {
    const result = await client.merchant.auth.resetPassword({ email, reset_code, password })
    return NextResponse.json({ ok: true, message: result.message })
  } catch (err) {
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    throw err
  }
}
