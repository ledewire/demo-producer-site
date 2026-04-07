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
  config: {
    ledewireBaseUrl: 'https://test.ledewire.com',
  },
}))

import { createClient } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { POST } from './route'

/** Build a minimal, structurally-valid JWT with the given `aud` claim. */
function makeJwt(aud: string): string {
  const header = Buffer.from('{"alg":"RS256"}').toString('base64url')
  const payload = Buffer.from(JSON.stringify({ aud, sub: 'user-123' })).toString('base64url')
  return `${header}.${payload}.fakesig`
}

const validToken = makeJwt('test-client-id.apps.googleusercontent.com')

const mockLoginWithGoogle = vi.fn()
const mockGetPublic = vi.fn()
const mockSave = vi.fn()

const mockTokens = {
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  expiresAt: 9999999999000,
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/google', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSave.mockResolvedValue(undefined)
  mockGetPublic.mockResolvedValue({ google_client_id: 'test-client-id.apps.googleusercontent.com' })
   
  vi.mocked(createClient).mockReturnValue({
    config: { getPublic: mockGetPublic },
    merchant: { auth: { loginWithGoogleAndListStores: mockLoginWithGoogle } },
  } as any)
})

describe('POST /api/auth/google', () => {
  it('returns 400 when id_token is missing', async () => {
    const res = await POST(makeRequest({}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/id_token/)
    expect(mockLoginWithGoogle).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/google', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when the JWT audience does not match the configured client ID', async () => {
    const wrongToken = makeJwt('other-app.apps.googleusercontent.com')

    const res = await POST(makeRequest({ id_token: wrongToken }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/audience/)
    expect(mockLoginWithGoogle).not.toHaveBeenCalled()
  })

  it('returns 400 when the JWT is malformed (no payload segment)', async () => {
    const res = await POST(makeRequest({ id_token: 'not.a.valid.jwt.with.too.many.segments' }))
    const body = await res.json()

    // A malformed token will produce a null audience which won't match
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/audience/)
  })

  it('skips audience validation when google_client_id is not in public config', async () => {
    mockGetPublic.mockResolvedValueOnce({ google_client_id: undefined })
    const stores = [{ id: 'store-1', name: 'My Store' }]
    mockLoginWithGoogle.mockResolvedValueOnce({ tokens: mockTokens, stores })
     
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)

    // Any token value is accepted when there is no configured client ID
    const res = await POST(makeRequest({ id_token: 'any-token-value' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockLoginWithGoogle).toHaveBeenCalledWith({ id_token: 'any-token-value' })
  })

  it('skips audience validation when the public config fetch fails', async () => {
    mockGetPublic.mockRejectedValueOnce(new Error('network error'))
    const stores = [{ id: 'store-1', name: 'My Store' }]
    mockLoginWithGoogle.mockResolvedValueOnce({ tokens: mockTokens, stores })
     
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)

    const res = await POST(makeRequest({ id_token: 'any-token-value' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('stores tokens and auto-selects the store when there is exactly one', async () => {
    const stores = [{ id: 'store-1', name: 'My Store' }]
    mockLoginWithGoogle.mockResolvedValueOnce({ tokens: mockTokens, stores })

     
    const session: Record<string, unknown> = { save: mockSave }
     
    vi.mocked(getSession).mockResolvedValueOnce(session as any)

    const res = await POST(makeRequest({ id_token: validToken }))
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
    mockLoginWithGoogle.mockResolvedValueOnce({ tokens: mockTokens, stores })

     
    const session: Record<string, unknown> = { save: mockSave }
     
    vi.mocked(getSession).mockResolvedValueOnce(session as any)

    const res = await POST(makeRequest({ id_token: validToken }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.requiresStoreSelection).toBe(true)
    expect(body.storeId).toBeNull()
    expect(session.storeId).toBeNull()
    expect(session.stores).toHaveLength(2)
    expect(mockSave).toHaveBeenCalledOnce()
  })

  it('returns 403 on ForbiddenError', async () => {
     
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)
    mockLoginWithGoogle.mockRejectedValueOnce(new ForbiddenError('no merchant role', 403))

    const res = await POST(makeRequest({ id_token: validToken }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('no merchant role')
  })

  it('returns 401 on AuthError', async () => {
     
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)
    mockLoginWithGoogle.mockRejectedValueOnce(new AuthError('invalid token', 401))

    const res = await POST(makeRequest({ id_token: validToken }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Google authentication failed')
  })

  it('returns the SDK status code on a generic LedewireError', async () => {
     
    vi.mocked(getSession).mockResolvedValueOnce({ save: mockSave } as any)
    mockLoginWithGoogle.mockRejectedValueOnce(new LedewireError('service unavailable', 503))

    const res = await POST(makeRequest({ id_token: validToken }))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe('service unavailable')
  })
})
