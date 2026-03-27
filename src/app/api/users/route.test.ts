import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, LedewireError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockMerchantUsers } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { POST } from './route'
import { makeMerchantUser } from '@/test/factories'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/users', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

describe('POST /api/users', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ author_fee_bps: 1000 }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/email/)
    expect(mockMerchantUsers.invite).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when author_fee_bps is out of range', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', author_fee_bps: 10001 }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/10000/)
    expect(mockMerchantUsers.invite).not.toHaveBeenCalled()
  })

  it('returns 400 when author_fee_bps is negative', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', author_fee_bps: -1 }))

    expect(res.status).toBe(400)
    expect(mockMerchantUsers.invite).not.toHaveBeenCalled()
  })

  it('returns 400 when author_fee_bps is not an integer', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', author_fee_bps: 18.5 }))

    expect(res.status).toBe(400)
    expect(mockMerchantUsers.invite).not.toHaveBeenCalled()
  })

  it('invites successfully and returns 201', async () => {
    mockMerchantUsers.invite.mockResolvedValueOnce(makeMerchantUser({ email: 'a@b.com' }))

    const res = await POST(makeRequest({ email: 'a@b.com' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(mockMerchantUsers.invite).toHaveBeenCalledWith('store-abc', { email: 'a@b.com' })
  })

  it('invites with a fee override and returns 201', async () => {
    mockMerchantUsers.invite.mockResolvedValueOnce(
      makeMerchantUser({ email: 'a@b.com', author_fee_bps: 2000 }),
    )

    const res = await POST(makeRequest({ email: 'a@b.com', author_fee_bps: 2000 }))

    expect(res.status).toBe(201)
    expect(mockMerchantUsers.invite).toHaveBeenCalledWith('store-abc', {
      email: 'a@b.com',
      author_fee_bps: 2000,
    })
  })

  it('does not send author_fee_bps to the SDK when it is omitted', async () => {
    mockMerchantUsers.invite.mockResolvedValueOnce(makeMerchantUser({ email: 'a@b.com' }))

    await POST(makeRequest({ email: 'a@b.com' }))

    expect(mockMerchantUsers.invite).toHaveBeenCalledWith('store-abc', { email: 'a@b.com' })
    // author_fee_bps key should not be present
    const callArg = mockMerchantUsers.invite.mock.calls[0][1] as Record<string, unknown>
    expect('author_fee_bps' in callArg).toBe(false)
  })

  it('accepts null for author_fee_bps (store default)', async () => {
    mockMerchantUsers.invite.mockResolvedValueOnce(makeMerchantUser({ email: 'a@b.com' }))

    const res = await POST(makeRequest({ email: 'a@b.com', author_fee_bps: null }))

    expect(res.status).toBe(201)
    expect(mockMerchantUsers.invite).toHaveBeenCalledWith('store-abc', {
      email: 'a@b.com',
      author_fee_bps: null,
    })
  })

  it('returns 401 on AuthError', async () => {
    mockMerchantUsers.invite.mockRejectedValueOnce(new AuthError('Unauthorized', 401))

    const res = await POST(makeRequest({ email: 'a@b.com' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns the SDK status code on a LedewireError', async () => {
    mockMerchantUsers.invite.mockRejectedValueOnce(new LedewireError('conflict', 409))

    const res = await POST(makeRequest({ email: 'a@b.com' }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe('conflict')
  })
})
