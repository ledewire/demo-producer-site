import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, LedewireError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockMerchantPricingRules } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { GET, POST } from './route'
import { makePricingRule } from '@/test/factories'

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pricing-rules', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

describe('GET /api/pricing-rules', () => {
  it('returns rules list', async () => {
    const rule = makePricingRule()
    mockMerchantPricingRules.list.mockResolvedValueOnce([rule])

    const res = await GET(new NextRequest('http://localhost/api/pricing-rules'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.rules).toHaveLength(1)
    expect(body.rules[0].id).toBe('rule-001')
    expect(mockMerchantPricingRules.list).toHaveBeenCalledWith('store-abc')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue({} as any)

    const res = await GET(new NextRequest('http://localhost/api/pricing-rules'))

    expect(res.status).toBe(401)
    expect(mockMerchantPricingRules.list).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError from SDK', async () => {
    mockMerchantPricingRules.list.mockRejectedValueOnce(new AuthError('expired', 401))

    const res = await GET(new NextRequest('http://localhost/api/pricing-rules'))

    expect(res.status).toBe(401)
  })

  it('returns SDK statusCode on LedewireError', async () => {
    const err = new LedewireError('server error', 500)
    mockMerchantPricingRules.list.mockRejectedValueOnce(err)

    const res = await GET(new NextRequest('http://localhost/api/pricing-rules'))

    expect(res.status).toBe(500)
  })
})

describe('POST /api/pricing-rules', () => {
  it('returns 400 when url_pattern is missing', async () => {
    const res = await POST(makePostRequest({ price_cents: 150 }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/url_pattern/)
    expect(mockMerchantPricingRules.create).not.toHaveBeenCalled()
  })

  it('returns 400 when url_pattern does not start with http', async () => {
    const res = await POST(
      makePostRequest({ url_pattern: 'ftp://example.com/*', price_cents: 150 }),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/https?/)
  })

  it('returns 400 when price_cents is missing', async () => {
    const res = await POST(makePostRequest({ url_pattern: 'https://example.com/*' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/price_cents/)
  })

  it('returns 400 when price_cents is negative', async () => {
    const res = await POST(
      makePostRequest({ url_pattern: 'https://example.com/*', price_cents: -1 }),
    )

    expect(res.status).toBe(400)
    expect(mockMerchantPricingRules.create).not.toHaveBeenCalled()
  })

  it('returns 400 when price_cents is not an integer', async () => {
    const res = await POST(
      makePostRequest({ url_pattern: 'https://example.com/*', price_cents: 1.5 }),
    )

    expect(res.status).toBe(400)
    expect(mockMerchantPricingRules.create).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/pricing-rules', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates a rule and returns 201', async () => {
    const rule = makePricingRule()
    mockMerchantPricingRules.create.mockResolvedValueOnce(rule)

    const res = await POST(
      makePostRequest({ url_pattern: 'https://example.com/articles/*', price_cents: 150 }),
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.rule.id).toBe('rule-001')
    expect(mockMerchantPricingRules.create).toHaveBeenCalledWith('store-abc', {
      url_pattern: 'https://example.com/articles/*',
      price_cents: 150,
    })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue({} as any)

    const res = await POST(
      makePostRequest({ url_pattern: 'https://example.com/*', price_cents: 100 }),
    )

    expect(res.status).toBe(401)
    expect(mockMerchantPricingRules.create).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError from SDK', async () => {
    mockMerchantPricingRules.create.mockRejectedValueOnce(new AuthError('expired', 401))

    const res = await POST(
      makePostRequest({ url_pattern: 'https://example.com/*', price_cents: 100 }),
    )

    expect(res.status).toBe(401)
  })

  it('returns 403 on ForbiddenError from SDK', async () => {
    const { ForbiddenError } = await import('@ledewire/node')
    mockMerchantPricingRules.create.mockRejectedValueOnce(
      new ForbiddenError('insufficient access', 403),
    )

    const res = await POST(
      makePostRequest({ url_pattern: 'https://example.com/*', price_cents: 100 }),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/insufficient access/)
  })

  it('accepts price_cents of 0 (free access)', async () => {
    const rule = makePricingRule({ price_cents: 0 })
    mockMerchantPricingRules.create.mockResolvedValueOnce(rule)

    const res = await POST(
      makePostRequest({ url_pattern: 'https://example.com/*', price_cents: 0 }),
    )

    expect(res.status).toBe(201)
    expect(mockMerchantPricingRules.create).toHaveBeenCalledWith('store-abc', {
      url_pattern: 'https://example.com/*',
      price_cents: 0,
    })
  })
})
