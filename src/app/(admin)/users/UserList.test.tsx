import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserList from './UserList'
import { makeMerchantUser } from '@/test/factories'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

const mockPush = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function okResponse(body: unknown = { ok: true }) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
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

// ── Rendering ────────────────────────────────────────────────────────────────

describe('UserList rendering', () => {
  it('shows an empty state when there are no users', () => {
    render(<UserList initialUsers={[]} />)
    expect(screen.getByText(/No team members yet/)).toBeInTheDocument()
  })

  it('renders user email and role', () => {
    const owner = makeMerchantUser({ role: 'owner', email: 'owner@example.com' })
    render(<UserList initialUsers={[owner]} />)
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
  })

  it('shows no Pending badge for a user who has accepted', () => {
    const accepted = makeMerchantUser({
      email: 'accepted@example.com',
      invited_at: '2026-01-01T00:00:00Z',
      accepted_at: '2026-01-02T00:00:00Z',
    })
    render(<UserList initialUsers={[accepted]} />)
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  })

  it('shows a Pending badge for an invited user who has not yet accepted', () => {
    const pending = makeMerchantUser({
      email: 'pending@example.com',
      invited_at: '2026-01-01T00:00:00Z',
      accepted_at: null,
    })
    render(<UserList initialUsers={[pending]} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows no Pending badge when invited_at is null', () => {
    const user = makeMerchantUser({ invited_at: null, accepted_at: null })
    render(<UserList initialUsers={[user]} />)
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  })

  it('does not render a fee editor for the owner', () => {
    const owner = makeMerchantUser({ role: 'owner' })
    render(<UserList initialUsers={[owner]} />)
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('shows the formatted fee for a non-owner author', () => {
    const author = makeMerchantUser({ role: null, author_fee_bps: 1800 })
    render(<UserList initialUsers={[author]} />)
    expect(screen.getByText('18%')).toBeInTheDocument()
  })

  it('shows "Store default" when author_fee_bps is null', () => {
    const author = makeMerchantUser({ role: null, author_fee_bps: null })
    render(<UserList initialUsers={[author]} />)
    expect(screen.getByText('Store default')).toBeInTheDocument()
  })
})

// ── Delete ───────────────────────────────────────────────────────────────────

describe('UserList delete', () => {
  it('removes the user row optimistically on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    const user = makeMerchantUser({ id: 'u-1', email: 'gone@example.com' })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))

    await waitFor(() => {
      expect(screen.queryByText('gone@example.com')).not.toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/users/u-1', { method: 'DELETE' })
  })

  it('does not call the API when the user cancels the confirmation', async () => {
    const user = makeMerchantUser({ id: 'u-1', email: 'stay@example.com' })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(screen.getByText('stay@example.com')).toBeInTheDocument()
  })

  it('shows an error and keeps the user in the list when the API fails', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Cannot remove owner' }, 422))
    const user = makeMerchantUser({ id: 'u-1', email: 'keep@example.com' })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))

    await waitFor(() => {
      expect(screen.getByText('Cannot remove owner')).toBeInTheDocument()
    })
    expect(screen.getByText('keep@example.com')).toBeInTheDocument()
  })

  it('redirects to /login on a 401 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Unauthorized' }, 401))
    const user = makeMerchantUser({ id: 'u-1' })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})

// ── Fee editor ───────────────────────────────────────────────────────────────

describe('UserList fee editor', () => {
  it('opens the editor when Edit is clicked', async () => {
    const user = makeMerchantUser({ role: null, author_fee_bps: 1800 })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Author fee percentage')).toBeInTheDocument()
  })

  it('closes the editor without saving when Cancel is clicked', async () => {
    const user = makeMerchantUser({ role: null, author_fee_bps: 1800 })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Author fee percentage')).not.toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows a validation error for an out-of-range percentage', async () => {
    const user = makeMerchantUser({ id: 'u-1', role: null, author_fee_bps: null })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByLabelText('Author fee percentage')
    await userEvent.clear(input)
    await userEvent.type(input, '150')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText(/0 and 100/)).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('PATCHes with correct bps and updates the displayed fee on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true, user: { author_fee_bps: 2000 } }))
    const user = makeMerchantUser({ id: 'u-1', role: null, author_fee_bps: null })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByLabelText('Author fee percentage')
    await userEvent.clear(input)
    await userEvent.type(input, '20')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('20%')).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/users/u-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ author_fee_bps: 2000 }),
      }),
    )
  })

  it('sends null when Default is clicked (reverts to store default)', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true, user: { author_fee_bps: null } }))
    const user = makeMerchantUser({ id: 'u-1', role: null, author_fee_bps: 1800 })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Default' }))

    await waitFor(() => {
      expect(screen.getByText('Store default')).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/users/u-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ author_fee_bps: null }),
      }),
    )
  })

  it('shows API error message when the PATCH fails', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Update failed' }, 422))
    const user = makeMerchantUser({ id: 'u-1', role: null, author_fee_bps: null })
    render(<UserList initialUsers={[user]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByLabelText('Author fee percentage')
    await userEvent.clear(input)
    await userEvent.type(input, '10')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })
  })
})
