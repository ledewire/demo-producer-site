import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockMerchantDomains } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { DELETE } from './route'

function makeParams(domainId: string) {
  return { params: Promise.resolve({ domainId }) }
}

function deleteRequest(domainId: string) {
  return new NextRequest(`http://localhost/api/domains/${domainId}`, { method: 'DELETE' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

describe('DELETE /api/domains/[domainId]', () => {
  it('removes the domain and returns 204', async () => {
    mockMerchantDomains.remove.mockResolvedValueOnce(undefined)

    const res = await DELETE(deleteRequest('domain-123'), makeParams('domain-123'))

    expect(res.status).toBe(204)
    expect(res.body).toBeNull()
    expect(mockMerchantDomains.remove).toHaveBeenCalledWith('store-abc', 'domain-123')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue({} as any)

    const res = await DELETE(deleteRequest('domain-123'), makeParams('domain-123'))

    expect(res.status).toBe(401)
    expect(mockMerchantDomains.remove).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError from SDK', async () => {
    mockMerchantDomains.remove.mockRejectedValueOnce(new AuthError('expired', 401))

    const res = await DELETE(deleteRequest('domain-123'), makeParams('domain-123'))

    expect(res.status).toBe(401)
  })

  it('returns 403 on ForbiddenError from SDK', async () => {
    mockMerchantDomains.remove.mockRejectedValueOnce(new ForbiddenError('insufficient access', 403))

    const res = await DELETE(deleteRequest('domain-123'), makeParams('domain-123'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/insufficient access/)
  })

  it('returns 404 on NotFoundError from SDK', async () => {
    mockMerchantDomains.remove.mockRejectedValueOnce(new NotFoundError('domain not found', 404))

    const res = await DELETE(deleteRequest('domain-123'), makeParams('domain-123'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/domain not found/)
  })

  it('re-throws unexpected errors', async () => {
    mockMerchantDomains.remove.mockRejectedValueOnce(new Error('unexpected'))

    await expect(DELETE(deleteRequest('domain-123'), makeParams('domain-123'))).rejects.toThrow(
      'unexpected',
    )
  })
})
