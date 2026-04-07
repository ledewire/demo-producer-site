import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, ForbiddenError, LedewireError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockMerchantDomains } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/domains/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

describe('POST /api/domains/verify', () => {
  it('returns 400 when domain is missing', async () => {
    const res = await POST(makeRequest({}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/domain/)
    expect(mockMerchantDomains.verify).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/domains/verify', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('triggers verification and returns 202', async () => {
    mockMerchantDomains.verify.mockResolvedValueOnce({
      queued: true,
      domain: 'example.com',
      status: 'pending',
    })

    const res = await POST(makeRequest({ domain: 'example.com' }))
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.queued).toBe(true)
    expect(body.domain).toBe('example.com')
    expect(mockMerchantDomains.verify).toHaveBeenCalledWith('store-abc', { domain: 'example.com' })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue({} as any)

    const res = await POST(makeRequest({ domain: 'example.com' }))

    expect(res.status).toBe(401)
    expect(mockMerchantDomains.verify).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError from SDK', async () => {
    mockMerchantDomains.verify.mockRejectedValueOnce(new AuthError('expired', 401))

    const res = await POST(makeRequest({ domain: 'example.com' }))

    expect(res.status).toBe(401)
  })

  it('returns 403 on ForbiddenError from SDK', async () => {
    mockMerchantDomains.verify.mockRejectedValueOnce(new ForbiddenError('insufficient access', 403))

    const res = await POST(makeRequest({ domain: 'example.com' }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/insufficient access/)
  })

  it('returns SDK statusCode on LedewireError', async () => {
    mockMerchantDomains.verify.mockRejectedValueOnce(new LedewireError('server error', 500))

    const res = await POST(makeRequest({ domain: 'example.com' }))

    expect(res.status).toBe(500)
  })

  it('re-throws unexpected errors', async () => {
    mockMerchantDomains.verify.mockRejectedValueOnce(new Error('unexpected'))

    await expect(POST(makeRequest({ domain: 'example.com' }))).rejects.toThrow('unexpected')
  })
})
