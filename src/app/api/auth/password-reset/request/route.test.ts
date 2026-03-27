import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { LedewireError } from '@ledewire/node'

// Partial mock: override createClient, keep real error classes
vi.mock('@ledewire/node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ledewire/node')>()
  return { ...actual, createClient: vi.fn() }
})
vi.mock('@/lib/config', () => ({
  config: { ledewireBaseUrl: 'https://test.ledewire.com' },
}))

import { createClient } from '@ledewire/node'
import { POST } from './route'

const mockRequestPasswordReset = vi.fn()

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient).mockReturnValue({
    merchant: { auth: { requestPasswordReset: mockRequestPasswordReset } },
  } as any)
})

describe('POST /api/auth/password-reset/request', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/email/)
    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('calls requestPasswordReset and returns ok on success', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({
      message: 'If an account with this email exists, a reset code has been sent.',
    })

    const res = await POST(makeRequest({ email: 'owner@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.message).toContain('reset code')
    expect(mockRequestPasswordReset).toHaveBeenCalledWith({ email: 'owner@example.com' })
  })

  it('returns the SDK status code on a LedewireError', async () => {
    mockRequestPasswordReset.mockRejectedValueOnce(new LedewireError('rate limit exceeded', 429))

    const res = await POST(makeRequest({ email: 'owner@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toBe('rate limit exceeded')
  })

  it('re-throws unexpected errors', async () => {
    mockRequestPasswordReset.mockRejectedValueOnce(new Error('unexpected'))

    await expect(POST(makeRequest({ email: 'owner@example.com' }))).rejects.toThrow('unexpected')
  })
})
