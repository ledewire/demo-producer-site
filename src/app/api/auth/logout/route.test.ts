import { describe, it, expect, vi, beforeEach } from 'vitest'

// Factory must not reference outer-scope variables (vi.mock is hoisted)
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))

import { getSession } from '@/lib/session'
import { POST } from './route'

const mockDestroy = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockDestroy.mockResolvedValue(undefined)
   
  vi.mocked(getSession).mockResolvedValue({ destroy: mockDestroy } as any)
})

describe('POST /api/auth/logout', () => {
  it('destroys the session and returns ok', async () => {
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockDestroy).toHaveBeenCalledOnce()
  })

  it('is idempotent — a second call also succeeds', async () => {
    await POST()
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})
