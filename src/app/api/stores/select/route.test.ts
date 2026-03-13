import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock iron-session — factory must not reference top-level variables (hoisting)
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}))

import { getSession } from '@/lib/session'
import { POST } from './route'

const mockSave = vi.fn()
const defaultSession = {
  accessToken: 'tok',
  storeId: 'store-a',
  stores: [{ store_id: 'store-a' }, { store_id: 'store-b' }],
  save: mockSave,
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/stores/select', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSave.mockResolvedValue(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getSession).mockResolvedValue({ ...defaultSession } as any)
})

describe('POST /api/stores/select', () => {
  it('switches to a valid store and saves the session', async () => {
    const res = await POST(makeRequest({ storeId: 'store-b' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockSave).toHaveBeenCalled()
  })

  it('returns 400 when the storeId is not in the merchants store list', async () => {
    const res = await POST(makeRequest({ storeId: 'store-unknown' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/Invalid store/)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('returns 400 when storeId is missing', async () => {
    const res = await POST(makeRequest({}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/storeId is required/)
  })

  it('returns 401 when the session has no access token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSession).mockResolvedValueOnce({ ...defaultSession, accessToken: undefined } as any)

    const res = await POST(makeRequest({ storeId: 'store-a' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 400 on malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/stores/select', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
