import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError, ForbiddenError, LedewireError } from '@ledewire/node'

// Partial mock: override createClient, keep real error classes
vi.mock('@ledewire/node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ledewire/node')>()
  return { ...actual, createClient: vi.fn() }
})

// Factory must not reference outer-scope variables (vi.mock is hoisted)
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/config', () => ({
  config: { ledewireBaseUrl: 'https://test.ledewire.com' },
}))

import { createClient } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { POST } from './route'

const mockLoginWithEmail = vi.fn()
const mockSave = vi.fn()

const mockTokens = {
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  expiresAt: 9999999999000,
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSave.mockResolvedValue(undefined)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient).mockReturnValue({
    merchant: { auth: { loginWithEmailAndListStores: mockLoginWithEmail } },
  } as any)
})

describe('POST /api/auth/login', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'secret' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/email and password/)
    expect(mockLoginWithEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/email and password/)
    expect(mockLoginWithEmail).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('stores tokens and auto-selects the store when there is exactly one', async () => {
    const stores = [{ id: 'store-1', name: 'My Store' }]
    mockLoginWithEmail.mockResolvedValueOnce({ tokens: mockTokens, stores })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session: Record<string, unknown> = { save: mockSave }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSession).mockResolvedValueOnce(session as any)

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.storeId).toBe('store-1')
    expect(body.requiresStoreSelection).toBe(false)
    expect(session.accessToken).toBe('access-tok')
    expect(session.refreshToken).toBe('refresh-tok')
    expect(session.expiresAt).toBe(9999999999000)
    expect(session.storeId).toBe('store-1')
    expect(session.stores).toEqual([{ id: 'store-1', name: 'My Store' }])
    expect(mockSave).toHaveBeenCalledOnce()
  })

  it('does not auto-select and sets requiresStoreSelection when there are multiple stores', async () => {
    const stores = [
      { id: 'store-1', name: 'Store A' },
      { id: 'store-2', name: 'Store B' },
    ]
    mockLoginWithEmail.mockResolvedValueOnce({ tokens: mockTokens, stores })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session: Record<string, unknown> = { save: mockSave }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSession).mockResolvedValueOnce(session as any)

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.requiresStoreSelection).toBe(true)
    expect(body.storeId).toBeNull()
    expect(session.storeId).toBeNull()
    expect(session.stores).toHaveLength(2)
    expect(mockSave).toHaveBeenCalledOnce()
  })

  it('returns 403 on ForbiddenError', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)
    mockLoginWithEmail.mockRejectedValueOnce(new ForbiddenError('no merchant role', 403))

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret' }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('no merchant role')
  })

  it('returns 401 on AuthError', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)
    mockLoginWithEmail.mockRejectedValueOnce(new AuthError('bad credentials', 401))

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Invalid email or password')
  })

  it('returns the SDK status code on a generic LedewireError', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)
    mockLoginWithEmail.mockRejectedValueOnce(new LedewireError('service unavailable', 503))

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret' }))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe('service unavailable')
  })
})
