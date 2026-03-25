import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ForbiddenError, LedewireError, NotFoundError } from '@ledewire/node'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockSellerContent } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { GET, PATCH, DELETE } from './route'
import { makeContent, makeExternalContent } from '@/test/factories'

function makeParams(contentId: string) {
  return { params: Promise.resolve({ contentId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

// ── GET /api/content/[contentId] ─────────────────────────────────────────

describe('GET /api/content/[contentId]', () => {
  it('returns the content item', async () => {
    const item = makeContent({ id: 'content-001', title: 'My Article' })
    mockSellerContent.get.mockResolvedValueOnce(item)

    const req = new NextRequest('http://localhost/api/content/content-001')
    const res = await GET(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.item.title).toBe('My Article')
    expect(mockSellerContent.get).toHaveBeenCalledWith('store-abc', 'content-001')
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({} as any)

    const req = new NextRequest('http://localhost/api/content/content-001')
    const res = await GET(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 404 when the item does not exist', async () => {
    mockSellerContent.get.mockRejectedValueOnce(new NotFoundError('not found', 404))

    const req = new NextRequest('http://localhost/api/content/content-999')
    const res = await GET(req, makeParams('content-999'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Content not found')
  })
})

// ── PATCH /api/content/[contentId] ───────────────────────────────────────

describe('PATCH /api/content/[contentId]', () => {
  it('updates and returns the content item', async () => {
    const updated = makeContent({ id: 'content-001', title: 'Updated Title', price_cents: 499 })
    mockSellerContent.update.mockResolvedValueOnce(updated)

    const req = new NextRequest('http://localhost/api/content/content-001', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated Title', price_cents: 499 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.content.title).toBe('Updated Title')
    expect(mockSellerContent.update).toHaveBeenCalledWith(
      'store-abc',
      'content-001',
      expect.objectContaining({ title: 'Updated Title', price_cents: 499 }),
    )
  })

  it('only sends provided fields — omits undefined keys', async () => {
    const updated = makeContent({ id: 'content-001' })
    mockSellerContent.update.mockResolvedValueOnce(updated)

    const req = new NextRequest('http://localhost/api/content/content-001', {
      method: 'PATCH',
      body: JSON.stringify({ visibility: 'private' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await PATCH(req, makeParams('content-001'))

    const call = mockSellerContent.update.mock.calls[0][2] as Record<string, unknown>
    expect(Object.keys(call)).toEqual(['visibility'])
  })

  it('returns 400 when no fields are provided', async () => {
    const req = new NextRequest('http://localhost/api/content/content-001', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/No fields/)
    expect(mockSellerContent.update).not.toHaveBeenCalled()
  })

  it('returns 400 on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/content/content-001', {
      method: 'PATCH',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('content-001'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({} as any)

    const req = new NextRequest('http://localhost/api/content/content-001', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('content-001'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the item does not exist', async () => {
    mockSellerContent.update.mockRejectedValueOnce(new NotFoundError('not found', 404))

    const req = new NextRequest('http://localhost/api/content/content-001', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Content not found')
  })
})

// ── DELETE /api/content/[contentId] ──────────────────────────────────────

describe('DELETE /api/content/[contentId]', () => {
  it('deletes the content item and returns ok', async () => {
    mockSellerContent.delete.mockResolvedValueOnce(undefined)

    const req = new NextRequest('http://localhost/api/content/content-001', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockSellerContent.delete).toHaveBeenCalledWith('store-abc', 'content-001')
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({} as any)

    const req = new NextRequest('http://localhost/api/content/content-001', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 404 when the content does not exist', async () => {
    mockSellerContent.delete.mockRejectedValueOnce(new NotFoundError('not found', 404))

    const req = new NextRequest('http://localhost/api/content/content-999', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('content-999'))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Content not found')
  })

  it('returns the SDK status code on other LedewireErrors', async () => {
    mockSellerContent.delete.mockRejectedValueOnce(new LedewireError('forbidden', 403))

    const req = new NextRequest('http://localhost/api/content/content-001', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('re-throws unexpected errors', async () => {
    mockSellerContent.delete.mockRejectedValueOnce(new TypeError('network failure'))

    const req = new NextRequest('http://localhost/api/content/content-001', { method: 'DELETE' })
    await expect(DELETE(req, makeParams('content-001'))).rejects.toThrow('network failure')
  })
})

// ── external_ref PATCH ───────────────────────────────────────────────────

describe('PATCH /api/content/[contentId] — external_ref fields', () => {
  it('patches content_uri and external_identifier', async () => {
    const updated = makeExternalContent({
      id: 'content-001',
      content_uri: 'https://vimeo.com/updated',
    })
    mockSellerContent.update.mockResolvedValueOnce(updated)

    const req = new NextRequest('http://localhost/api/content/content-001', {
      method: 'PATCH',
      body: JSON.stringify({
        content_uri: 'https://vimeo.com/updated',
        external_identifier: 'vimeo:updated',
        content_type: 'external_ref',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    await PATCH(req, makeParams('content-001'))

    const call = mockSellerContent.update.mock.calls[0][2] as Record<string, unknown>
    expect(call.content_uri).toBe('https://vimeo.com/updated')
    expect(call.external_identifier).toBe('vimeo:updated')
    expect(call.content_type).toBe('external_ref')
    expect(Object.keys(call)).not.toContain('content_body')
  })
})

// ── ForbiddenError handling ───────────────────────────────────────────────

describe('GET /api/content/[contentId] — ForbiddenError', () => {
  it('returns 403 when the SDK throws a ForbiddenError', async () => {
    mockSellerContent.get.mockRejectedValueOnce(new ForbiddenError('forbidden', 403))

    const req = new NextRequest('http://localhost/api/content/content-001')
    const res = await GET(req, makeParams('content-001'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })
})
