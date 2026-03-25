import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InviteForm from './InviteForm'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function okResponse() {
  return Promise.resolve(
    new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function errorResponse(body: unknown, status = 422) {
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

describe('InviteForm', () => {
  it('renders the email input and submit button', () => {
    render(<InviteForm />)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument()
  })

  it('shows a client-side error for an invalid fee percentage', async () => {
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/author fee override/i), '150')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(screen.getByText(/0 and 100/)).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows a client-side error for a negative fee', async () => {
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/author fee override/i), '-5')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(screen.getByText(/0 and 100/)).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends the invite without author_fee_bps when the fee field is left blank', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'a@b.com' }),
        }),
      )
    })
  })

  it('sends the correct bps value when a fee is entered', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/author fee override/i), '18')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          body: JSON.stringify({ email: 'a@b.com', author_fee_bps: 1800 }),
        }),
      )
    })
  })

  it('shows the success message and clears the form on a successful invite', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/author fee override/i), '18')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText(/Invitation sent/)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/email address/i)).toHaveValue('')
    expect(screen.getByLabelText(/author fee override/i)).toHaveValue(null)
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows the API error message on a failed invite', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'User already invited' }))
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('User already invited')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Invitation sent/)).not.toBeInTheDocument()
  })

  it('redirects to /login on a 401 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Unauthorized' }, 401))
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolve!: () => void
    mockFetch.mockReturnValueOnce(new Promise((r) => (resolve = () => r(okResponse()))))
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(screen.getByRole('button', { name: /Sending/ })).toBeDisabled()
    resolve()
  })
})
