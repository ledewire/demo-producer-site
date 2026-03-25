import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StorePicker from './StorePicker'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockPush = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const stores = [
  { id: 'store-a', name: 'Store Alpha' },
  { id: 'store-b', name: 'Store Beta' },
]

function okResponse() {
  return Promise.resolve(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function errorResponse(body: unknown, status = 400) {
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

describe('StorePicker', () => {
  it('renders a button for each store', () => {
    render(<StorePicker stores={stores} />)
    expect(screen.getByRole('button', { name: /Store Alpha/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Store Beta/ })).toBeInTheDocument()
  })

  it('renders an empty-state message when stores list is empty', () => {
    render(<StorePicker stores={[]} />)
    expect(screen.getByText(/No stores are available/)).toBeInTheDocument()
  })

  it('POSTs the selected storeId and redirects to /dashboard on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<StorePicker stores={stores} />)

    await userEvent.click(screen.getByRole('button', { name: /Store Alpha/ }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/stores/select',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ storeId: 'store-a' }),
      }),
    )
  })

  it('disables all buttons and shows Selecting… on the clicked store while the request is in flight', async () => {
    let resolve!: () => void
    mockFetch.mockReturnValueOnce(new Promise((r) => (resolve = () => r(okResponse()))))
    render(<StorePicker stores={stores} />)

    await userEvent.click(screen.getByRole('button', { name: /Store Alpha/ }))

    expect(screen.getByText('Selecting…')).toBeInTheDocument()
    // All buttons should be disabled
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled()
    }
    resolve()
  })

  it('shows an error message and re-enables buttons when the API call fails', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Invalid store' }))
    render(<StorePicker stores={stores} />)

    await userEvent.click(screen.getByRole('button', { name: /Store Alpha/ }))

    await waitFor(() => {
      expect(screen.getByText('Invalid store')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
    // Buttons should be re-enabled after the error
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).not.toBeDisabled()
    }
  })

  it('shows a network error message when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))
    render(<StorePicker stores={stores} />)

    await userEvent.click(screen.getByRole('button', { name: /Store Beta/ }))

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})
