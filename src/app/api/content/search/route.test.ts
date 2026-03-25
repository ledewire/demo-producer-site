import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, LedewireError } from '@ledewire/node'
import { makeContent, makePagination } from '@/test/factories'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ storeId: 'store-abc' }),
}))

import { mockSellerContent } from '@/__mocks__/ledewire-client'
import { requireAuth } from '@/lib/auth'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/content/search', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ storeId: 'store-abc' })
})

describe('POST /api/content/search', () => {
  it('returns items matching the metadata query', async () => {
    const items = [makeContent({ title: 'Tagged Article' })]
    mockSellerContent.search.mockResolvedValueOnce({ data: items, pagination: makePagination(1) })

    const res = await POST(makeRequest({ metadata: { tag: 'featured' } }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toEqual(items)
    expect(mockSellerContent.search).toHaveBeenCalledWith('store-abc', {
      metadata: { tag: 'featured' },
    })
  })

  it('returns 400 when metadata is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when metadata is not an object', async () => {
    const res = await POST(makeRequest({ metadata: 'not-an-object' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/content/search', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError('Unauthorized', 401))
    const res = await POST(makeRequest({ metadata: {} }))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('forwards SDK errors with their status code', async () => {
    mockSellerContent.search.mockRejectedValueOnce(new LedewireError('store not found', 404))
    const res = await POST(makeRequest({ metadata: {} }))
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe('store not found')
  })
})
