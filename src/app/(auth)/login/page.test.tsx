import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/server', () => ({ connection: vi.fn() }))
vi.mock('@ledewire/node', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/config', () => ({ config: { ledewireBaseUrl: 'https://test.ledewire.com' } }))
vi.mock('./LoginForm', () => ({ default: () => null }))

import { connection } from 'next/server'
import { createClient } from '@ledewire/node'
import LoginPage from './page'

const mockGetPublic = vi.fn()

beforeEach(() => {
  vi.mocked(connection).mockReset().mockResolvedValue(undefined)
  mockGetPublic.mockReset()
  vi.mocked(createClient).mockReturnValue({ config: { getPublic: mockGetPublic } } as any)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LoginPage', () => {
  it('passes the Google client ID from the public config to the form', async () => {
    mockGetPublic.mockResolvedValueOnce({ google_client_id: 'test-client-id' })

    const page = await LoginPage()

    expect(page.props.googleClientId).toBe('test-client-id')
  })

  it('opts out of prerendering before fetching the public config', async () => {
    const prerenderSignal = new Error('prerender stopped')
    vi.mocked(connection).mockRejectedValueOnce(prerenderSignal)

    await expect(LoginPage()).rejects.toBe(prerenderSignal)
    expect(mockGetPublic).not.toHaveBeenCalled()
  })

  it('hides Google Sign-In and logs when the public config fetch fails', async () => {
    const failure = new Error('API unreachable')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetPublic.mockRejectedValueOnce(failure)

    const page = await LoginPage()

    expect(page.props.googleClientId).toBeNull()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[login]'), failure)
  })
})
