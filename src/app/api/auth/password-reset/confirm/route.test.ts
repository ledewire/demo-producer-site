import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { LedewireError, NotFoundError } from '@ledewire/node'

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

const mockResetPassword = vi.fn()

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = { email: 'owner@example.com', reset_code: '123456', password: 'newpass1' }

beforeEach(() => {
  vi.clearAllMocks()
   
  vi.mocked(createClient).mockReturnValue({
    merchant: { auth: { resetPassword: mockResetPassword } },
  } as any)
})

describe('POST /api/auth/password-reset/confirm', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ reset_code: '123456', password: 'newpass1' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/required/)
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('returns 400 when reset_code is missing', async () => {
    const res = await POST(makeRequest({ email: 'owner@example.com', password: 'newpass1' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/required/)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'owner@example.com', reset_code: '123456' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/required/)
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/password-reset/confirm', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('calls resetPassword and returns ok on success', async () => {
    mockResetPassword.mockResolvedValueOnce({ message: 'Password has been reset successfully.' })

    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockResetPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      reset_code: '123456',
      password: 'newpass1',
    })
  })

  it('returns 404 when the reset code is invalid or expired', async () => {
    mockResetPassword.mockRejectedValueOnce(
      new NotFoundError('Invalid or expired reset code', 404),
    )

    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Invalid or expired reset code')
  })

  it('returns the SDK status code on a generic LedewireError', async () => {
    mockResetPassword.mockRejectedValueOnce(new LedewireError('service unavailable', 503))

    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe('service unavailable')
  })

  it('re-throws unexpected errors', async () => {
    mockResetPassword.mockRejectedValueOnce(new Error('unexpected'))

    await expect(POST(makeRequest(validBody))).rejects.toThrow('unexpected')
  })
})
