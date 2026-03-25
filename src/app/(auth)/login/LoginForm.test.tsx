import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from './LoginForm'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockPush = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function okResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function errorResponse(body: unknown, status: number) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Rendering ────────────────────────────────────────────────────────────────

describe('LoginForm rendering', () => {
  it('renders email and password fields and a sign-in button', () => {
    render(<LoginForm googleClientId={null} />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('does not render the Google button container when googleClientId is null', () => {
    render(<LoginForm googleClientId={null} />)
    expect(screen.queryByText('or')).not.toBeInTheDocument()
  })

  it('renders the Google button container when googleClientId is provided', () => {
    render(<LoginForm googleClientId="test-client-id.apps.googleusercontent.com" />)
    expect(screen.getByText('or')).toBeInTheDocument()
    expect(document.getElementById('google-signin-btn')).toBeInTheDocument()
  })
})

// ── Email / password login ────────────────────────────────────────────────

describe('LoginForm email/password login', () => {
  it('redirects to /dashboard after a successful single-store login', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ ok: true, requiresStoreSelection: false, storeId: 'store-1' }),
    )
    render(<LoginForm googleClientId={null} />)

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
      }),
    )
  })

  it('redirects to /select-store when requiresStoreSelection is true', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ ok: true, requiresStoreSelection: true, storeId: null }),
    )
    render(<LoginForm googleClientId={null} />)

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/select-store')
    })
  })

  it('shows the API error message on a 401 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Invalid email or password' }, 401))
    render(<LoginForm googleClientId={null} />)

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows the API error message on a 403 (no merchant role)', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Forbidden: no merchant role' }, 403))
    render(<LoginForm googleClientId={null} />)

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByText('Forbidden: no merchant role')).toBeInTheDocument()
    })
  })

  it('disables the button and shows Signing in… while the request is in flight', async () => {
    let resolve!: () => void
    mockFetch.mockReturnValueOnce(
      new Promise(
        (r) => (resolve = () => r(okResponse({ ok: true, requiresStoreSelection: false }))),
      ),
    )
    render(<LoginForm googleClientId={null} />)

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: /Signing in/ })).toBeDisabled()
    resolve()
  })
})

// ── Google Sign-In callback ───────────────────────────────────────────────

describe('LoginForm Google Sign-In callback', () => {
  it('redirects to /dashboard after a successful Google login', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ ok: true, requiresStoreSelection: false, storeId: 'store-1' }),
    )

    let capturedCallback: ((r: { credential: string }) => void) | undefined
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn().mockImplementation((cfg: { callback: typeof capturedCallback }) => {
            capturedCallback = cfg.callback
          }),
          renderButton: vi.fn(),
        },
      },
    }

    render(<LoginForm googleClientId="test-client-id.apps.googleusercontent.com" />)

    // Simulate the GIS script loading and firing the callback
    const script = document.querySelector('script[src*="accounts.google.com"]') as HTMLScriptElement
    script?.dispatchEvent(new Event('load'))

    await waitFor(() => expect(capturedCallback).toBeDefined())
    await capturedCallback!({ credential: 'google-id-token' })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/google',
      expect.objectContaining({
        body: JSON.stringify({ id_token: 'google-id-token' }),
      }),
    )
  })

  it('shows an error when the Google auth API call fails', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Google authentication failed' }, 401))

    let capturedCallback: ((r: { credential: string }) => void) | undefined
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn().mockImplementation((cfg: { callback: typeof capturedCallback }) => {
            capturedCallback = cfg.callback
          }),
          renderButton: vi.fn(),
        },
      },
    }

    render(<LoginForm googleClientId="test-client-id.apps.googleusercontent.com" />)

    const script = document.querySelector('script[src*="accounts.google.com"]') as HTMLScriptElement
    script?.dispatchEvent(new Event('load'))

    await waitFor(() => expect(capturedCallback).toBeDefined())
    await capturedCallback!({ credential: 'bad-token' })

    await waitFor(() => {
      expect(screen.getByText('Google authentication failed')).toBeInTheDocument()
    })
  })
})
