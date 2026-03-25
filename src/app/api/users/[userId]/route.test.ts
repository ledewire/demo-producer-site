import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, ForbiddenError, LedewireError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ storeId: 'store-abc' }),
}))

import { mockMerchantUsers } from '@/__mocks__/ledewire-client'
import { requireAuth } from '@/lib/auth'
import { PATCH, DELETE } from './route'
import { makeMerchantUser } from '@/test/factories'

function makeParams(userId: string) {
  return { params: Promise.resolve({ userId }) }
}

function patchRequest(userId: string, body: unknown) {
  return new NextRequest(`http://localhost/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ storeId: 'store-abc' })
})

// ── PATCH /api/users/[userId] ─────────────────────────────────────────────

describe('PATCH /api/users/[userId]', () => {
  it('sets author_fee_bps and returns the updated user', async () => {
    const updated = makeMerchantUser({ id: 'su-1', author_fee_bps: 1800 })
    mockMerchantUsers.update.mockResolvedValueOnce(updated)

    const res = await PATCH(patchRequest('su-1', { author_fee_bps: 1800 }), makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.user.author_fee_bps).toBe(1800)
    expect(mockMerchantUsers.update).toHaveBeenCalledWith('store-abc', 'su-1', {
      author_fee_bps: 1800,
    })
  })

  it('clears author_fee_bps (reverts to store default) when null is sent', async () => {
    const updated = makeMerchantUser({ id: 'su-1', author_fee_bps: null })
    mockMerchantUsers.update.mockResolvedValueOnce(updated)

    const res = await PATCH(patchRequest('su-1', { author_fee_bps: null }), makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.author_fee_bps).toBeNull()
    expect(mockMerchantUsers.update).toHaveBeenCalledWith('store-abc', 'su-1', {
      author_fee_bps: null,
    })
  })

  it('returns 400 for an out-of-range fee', async () => {
    const res = await PATCH(patchRequest('su-1', { author_fee_bps: 10001 }), makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/10000/)
    expect(mockMerchantUsers.update).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-integer fee', async () => {
    const res = await PATCH(patchRequest('su-1', { author_fee_bps: 18.5 }), makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(mockMerchantUsers.update).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/users/su-1', {
      method: 'PATCH',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('su-1'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError('Unauthorized', 401))

    const res = await PATCH(patchRequest('su-1', { author_fee_bps: 1000 }), makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns the SDK status code on a LedewireError', async () => {
    mockMerchantUsers.update.mockRejectedValueOnce(new LedewireError('user not found', 404))

    const res = await PATCH(patchRequest('su-1', { author_fee_bps: 1000 }), makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('user not found')
  })
})

// ── DELETE /api/users/[userId] ────────────────────────────────────────────

describe('DELETE /api/users/[userId]', () => {
  it('removes the user and returns ok', async () => {
    mockMerchantUsers.remove.mockResolvedValueOnce(undefined)

    const req = new NextRequest('http://localhost/api/users/su-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockMerchantUsers.remove).toHaveBeenCalledWith('store-abc', 'su-1')
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError('Unauthorized', 401))

    const req = new NextRequest('http://localhost/api/users/su-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns the SDK status code on a LedewireError', async () => {
    mockMerchantUsers.remove.mockRejectedValueOnce(new LedewireError('not found', 404))

    const req = new NextRequest('http://localhost/api/users/su-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('not found')
  })

  it('returns 403 on a ForbiddenError', async () => {
    mockMerchantUsers.remove.mockRejectedValueOnce(new ForbiddenError('forbidden', 403))

    const req = new NextRequest('http://localhost/api/users/su-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })
})

// ── PATCH ForbiddenError ──────────────────────────────────────────────────

describe('PATCH /api/users/[userId] — ForbiddenError', () => {
  it('returns 403 on a ForbiddenError', async () => {
    mockMerchantUsers.update.mockRejectedValueOnce(new ForbiddenError('forbidden', 403))

    const res = await PATCH(patchRequest('su-1', { author_fee_bps: 1000 }), makeParams('su-1'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })
})
