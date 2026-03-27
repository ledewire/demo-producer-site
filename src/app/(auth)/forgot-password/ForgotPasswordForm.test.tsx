import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordForm from './ForgotPasswordForm'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

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

describe('ForgotPasswordForm rendering', () => {
  it('renders the email field and send reset code button initially', () => {
    render(<ForgotPasswordForm />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send reset code' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument()
  })

  it('does not show the confirm step fields initially', () => {
    render(<ForgotPasswordForm />)
    expect(screen.queryByLabelText('Reset code')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
})

// ── Request step ─────────────────────────────────────────────────────────────

describe('ForgotPasswordForm request step', () => {
  it('submits the email to the request endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ ok: true, message: 'If an account exists, a reset code has been sent.' }),
    )
    render(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/password-reset/request',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'owner@example.com' }),
      }),
    )
  })

  it('advances to the confirm step on success', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ ok: true, message: 'Reset code sent.' }),
    )
    render(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Reset code')).toBeInTheDocument()
      expect(screen.getByLabelText('New password')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Send reset code' })).not.toBeInTheDocument()
  })

  it('shows the submitted email in the confirm step instructions', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true, message: 'Sent.' }))
    render(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    await waitFor(() => {
      expect(screen.getByText(/owner@example\.com/)).toBeInTheDocument()
    })
  })

  it('shows the API error on failure', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'rate limit exceeded' }, 429))
    render(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    await waitFor(() => {
      expect(screen.getByText('rate limit exceeded')).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Reset code')).not.toBeInTheDocument()
  })

  it('disables the button and shows Sending… while in flight', async () => {
    let resolve!: () => void
    mockFetch.mockReturnValueOnce(
      new Promise((r) => (resolve = () => r(okResponse({ ok: true })))),
    )
    render(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(screen.getByRole('button', { name: /Sending/ })).toBeDisabled()
    resolve()
  })
})

// ── Confirm step ─────────────────────────────────────────────────────────────

describe('ForgotPasswordForm confirm step', () => {
  async function advanceToConfirmStep() {
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true, message: 'Sent.' }))
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))
    await waitFor(() => expect(screen.getByLabelText('Reset code')).toBeInTheDocument())
  }

  it('submits email, reset_code, and password to the confirm endpoint', async () => {
    await advanceToConfirmStep()
    mockFetch.mockResolvedValueOnce(
      okResponse({ ok: true, message: 'Password has been reset successfully.' }),
    )

    await userEvent.type(screen.getByLabelText('Reset code'), '246810')
    await userEvent.type(screen.getByLabelText('New password'), 'mynewpassword')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/auth/password-reset/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'owner@example.com',
          reset_code: '246810',
          password: 'mynewpassword',
        }),
      }),
    )
  })

  it('shows the success state after a successful reset', async () => {
    await advanceToConfirmStep()
    mockFetch.mockResolvedValueOnce(
      okResponse({ ok: true, message: 'Password has been reset successfully.' }),
    )

    await userEvent.type(screen.getByLabelText('Reset code'), '246810')
    await userEvent.type(screen.getByLabelText('New password'), 'mynewpassword')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByText(/password has been updated/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
  })

  it('shows the API error on an invalid reset code', async () => {
    await advanceToConfirmStep()
    mockFetch.mockResolvedValueOnce(
      errorResponse({ error: 'Invalid or expired reset code' }, 404),
    )

    await userEvent.type(screen.getByLabelText('Reset code'), '000000')
    await userEvent.type(screen.getByLabelText('New password'), 'mynewpassword')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired reset code')).toBeInTheDocument()
    })
    expect(screen.queryByText(/password has been updated/i)).not.toBeInTheDocument()
  })

  it('disables the button and shows Resetting… while in flight', async () => {
    await advanceToConfirmStep()
    let resolve!: () => void
    mockFetch.mockReturnValueOnce(
      new Promise((r) => (resolve = () => r(okResponse({ ok: true })))),
    )

    await userEvent.type(screen.getByLabelText('Reset code'), '246810')
    await userEvent.type(screen.getByLabelText('New password'), 'mynewpassword')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(screen.getByRole('button', { name: /Resetting/ })).toBeDisabled()
    resolve()
  })
})
