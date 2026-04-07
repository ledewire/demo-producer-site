import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, LedewireError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockMerchantDomains } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { GET, POST } from './route'
import { makeDomainVerification } from '@/test/factories'

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/domains', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

describe('GET /api/domains', () => {
  it('returns domains list', async () => {
    const domain = makeDomainVerification()
    mockMerchantDomains.list.mockResolvedValueOnce([domain])

    const res = await GET(new NextRequest('http://localhost/api/domains'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.domains).toHaveLength(1)
    expect(body.domains[0].domain).toBe('example.com')
    expect(mockMerchantDomains.list).toHaveBeenCalledWith('store-abc')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue({} as any)

    const res = await GET(new NextRequest('http://localhost/api/domains'))

    expect(res.status).toBe(401)
    expect(mockMerchantDomains.list).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError from SDK', async () => {
    mockMerchantDomains.list.mockRejectedValueOnce(new AuthError('expired', 401))

    const res = await GET(new NextRequest('http://localhost/api/domains'))

    expect(res.status).toBe(401)
  })

  it('returns SDK statusCode on LedewireError', async () => {
    const err = new LedewireError('server error', 500)
    mockMerchantDomains.list.mockRejectedValueOnce(err)

    const res = await GET(new NextRequest('http://localhost/api/domains'))

    expect(res.status).toBe(500)
  })
})

describe('POST /api/domains', () => {
  it('returns 400 when domain is missing', async () => {
    const res = await POST(makePostRequest({}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/domain/)
    expect(mockMerchantDomains.add).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/domains', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('adds a domain and returns 201', async () => {
    const record = makeDomainVerification()
    mockMerchantDomains.add.mockResolvedValueOnce(record)

    const res = await POST(makePostRequest({ domain: 'example.com' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.domain.id).toBe('domain-001')
    expect(mockMerchantDomains.add).toHaveBeenCalledWith('store-abc', { domain: 'example.com' })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue({} as any)

    const res = await POST(makePostRequest({ domain: 'example.com' }))

    expect(res.status).toBe(401)
    expect(mockMerchantDomains.add).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError from SDK', async () => {
    mockMerchantDomains.add.mockRejectedValueOnce(new AuthError('expired', 401))

    const res = await POST(makePostRequest({ domain: 'example.com' }))

    expect(res.status).toBe(401)
  })

  it('returns 403 on ForbiddenError from SDK', async () => {
    const { ForbiddenError } = await import('@ledewire/node')
    mockMerchantDomains.add.mockRejectedValueOnce(new ForbiddenError('insufficient access', 403))

    const res = await POST(makePostRequest({ domain: 'example.com' }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/insufficient access/)
  })
})
