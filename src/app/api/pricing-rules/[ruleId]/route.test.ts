import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockMerchantPricingRules } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { DELETE } from './route'
import { makePricingRule } from '@/test/factories'

function makeParams(ruleId: string) {
  return { params: Promise.resolve({ ruleId }) }
}

function deleteRequest(ruleId: string) {
  return new NextRequest(`http://localhost/api/pricing-rules/${ruleId}`, { method: 'DELETE' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

describe('DELETE /api/pricing-rules/[ruleId]', () => {
  it('deactivates the rule and returns the updated rule', async () => {
    const deactivated = makePricingRule({ id: 'rule-123', active: false })
    mockMerchantPricingRules.deactivate.mockResolvedValueOnce(deactivated)

    const res = await DELETE(deleteRequest('rule-123'), makeParams('rule-123'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.rule.id).toBe('rule-123')
    expect(body.rule.active).toBe(false)
    expect(mockMerchantPricingRules.deactivate).toHaveBeenCalledWith('store-abc', 'rule-123')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue({} as any)

    const res = await DELETE(deleteRequest('rule-123'), makeParams('rule-123'))

    expect(res.status).toBe(401)
    expect(mockMerchantPricingRules.deactivate).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError from SDK', async () => {
    mockMerchantPricingRules.deactivate.mockRejectedValueOnce(new AuthError('expired', 401))

    const res = await DELETE(deleteRequest('rule-123'), makeParams('rule-123'))

    expect(res.status).toBe(401)
  })

  it('returns 403 on ForbiddenError from SDK', async () => {
    mockMerchantPricingRules.deactivate.mockRejectedValueOnce(
      new ForbiddenError('insufficient access', 403),
    )

    const res = await DELETE(deleteRequest('rule-123'), makeParams('rule-123'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/insufficient access/)
  })

  it('returns 404 on NotFoundError from SDK', async () => {
    mockMerchantPricingRules.deactivate.mockRejectedValueOnce(
      new NotFoundError('rule not found', 404),
    )

    const res = await DELETE(deleteRequest('rule-123'), makeParams('rule-123'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/rule not found/)
  })

  it('re-throws unexpected errors', async () => {
    mockMerchantPricingRules.deactivate.mockRejectedValueOnce(new Error('unexpected'))

    await expect(DELETE(deleteRequest('rule-123'), makeParams('rule-123'))).rejects.toThrow(
      'unexpected',
    )
  })
})
