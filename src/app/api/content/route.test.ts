import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, ForbiddenError, LedewireError } from '@ledewire/node'
import { makeContent, makeExternalContent, makePagination } from '@/test/factories'

// --- module mocks --------------------------------------------------------
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' }),
}))

import { mockSellerContent } from '@/__mocks__/ledewire-client'
import { getSession } from '@/lib/session'
import { GET, POST } from './route'

// -------------------------------------------------------------------------

function makeRequest(body?: unknown, method = 'GET') {
  return new NextRequest('http://localhost/api/content', {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok', storeId: 'store-abc' } as any)
})

// ── GET /api/content ─────────────────────────────────────────────────────

describe('GET /api/content', () => {
  it('returns the content list from the SDK', async () => {
    const items = [
      makeContent({ id: '1', title: 'Article A' }),
      makeContent({ id: '2', title: 'Article B' }),
    ]
    mockSellerContent.list.mockResolvedValueOnce({ data: items, pagination: makePagination(2) })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.items[0].title).toBe('Article A')
    expect(mockSellerContent.list).toHaveBeenCalledWith('store-abc')
  })

  it('returns an empty array when the store has no content', async () => {
    mockSellerContent.list.mockResolvedValueOnce({ data: [], pagination: makePagination(0) })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toEqual([])
  })

  it('returns 401 when the session is unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({} as any)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns the SDK status code on a LedewireError', async () => {
    mockSellerContent.list.mockRejectedValueOnce(new LedewireError('store not found', 404))

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('store not found')
  })
})

// ── POST /api/content ────────────────────────────────────────────────────

describe('POST /api/content', () => {
  const validBody = {
    title: 'New Article',
    price_cents: 299,
    content_body: btoa('# Hello'),
    visibility: 'public',
    content_type: 'markdown',
  }

  it('creates content and returns 201 with the created item', async () => {
    const created = makeContent({ title: 'New Article', price_cents: 299 })
    mockSellerContent.create.mockResolvedValueOnce(created)

    const res = await POST(makeRequest(validBody, 'POST'))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.content.title).toBe('New Article')
    expect(mockSellerContent.create).toHaveBeenCalledWith(
      'store-abc',
      expect.objectContaining({ title: 'New Article', price_cents: 299 }),
    )
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest({ title: 'Only title' }, 'POST'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/required/)
    expect(mockSellerContent.create).not.toHaveBeenCalled()
  })

  it('returns 400 on malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/content', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/JSON/)
  })

  it('returns 401 on AuthError', async () => {
    mockSellerContent.create.mockRejectedValueOnce(new AuthError('Unauthorized', 401))

    const res = await POST(makeRequest(validBody, 'POST'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('creates external_ref content with content_uri and external_identifier', async () => {
    const created = makeExternalContent({ title: 'Intro Video', price_cents: 1500 })
    mockSellerContent.create.mockResolvedValueOnce(created)

    const externalBody = {
      title: 'Intro Video',
      price_cents: 1500,
      content_type: 'external_ref',
      content_uri: 'https://vimeo.com/987654321',
      external_identifier: 'vimeo:987654321',
      visibility: 'public',
    }
    const res = await POST(makeRequest(externalBody, 'POST'))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(mockSellerContent.create).toHaveBeenCalledWith(
      'store-abc',
      expect.objectContaining({
        content_type: 'external_ref',
        content_uri: 'https://vimeo.com/987654321',
        external_identifier: 'vimeo:987654321',
      }),
    )
  })

  it('returns 400 when external_ref content is missing content_uri', async () => {
    const res = await POST(
      makeRequest({ title: 'No URI', price_cents: 500, content_type: 'external_ref' }, 'POST'),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/content_uri/)
    expect(mockSellerContent.create).not.toHaveBeenCalled()
  })

  it('returns 400 when markdown content is missing content_body', async () => {
    const res = await POST(
      makeRequest({ title: 'No Body', price_cents: 500, content_type: 'markdown' }, 'POST'),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/content_body/)
    expect(mockSellerContent.create).not.toHaveBeenCalled()
  })

  it('returns the SDK status code on a LedewireError during create', async () => {
    mockSellerContent.create.mockRejectedValueOnce(new LedewireError('unprocessable', 422))

    const res = await POST(makeRequest(validBody, 'POST'))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toBe('unprocessable')
  })

  it('returns 403 on a ForbiddenError during create', async () => {
    mockSellerContent.create.mockRejectedValueOnce(new ForbiddenError('forbidden', 403))

    const res = await POST(makeRequest(validBody, 'POST'))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })
})
