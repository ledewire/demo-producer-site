import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StoreSelector from './StoreSelector'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
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

describe('StoreSelector', () => {
  it('renders an option for each store', () => {
    render(<StoreSelector stores={stores} currentStoreId="store-a" />)
    expect(screen.getByRole('option', { name: 'Store Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Store Beta' })).toBeInTheDocument()
  })

  it('selects the current store by default', () => {
    render(<StoreSelector stores={stores} currentStoreId="store-a" />)
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('store-a')
  })

  it('POSTs the new storeId and navigates to the current path on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<StoreSelector stores={stores} currentStoreId="store-a" />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'store-b')

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/stores/select',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ storeId: 'store-b' }),
      }),
    )
  })

  it('disables the select while switching is in progress', async () => {
    let resolve!: () => void
    mockFetch.mockReturnValueOnce(new Promise((r) => (resolve = () => r(okResponse()))))
    render(<StoreSelector stores={stores} currentStoreId="store-a" />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'store-b')

    expect(screen.getByRole('combobox')).toBeDisabled()

    resolve()
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
  })

  it('shows an error message and does not navigate when the API returns an error', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Invalid store' }))
    render(<StoreSelector stores={stores} currentStoreId="store-a" />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'store-b')

    await waitFor(() => {
      expect(screen.getByText('Invalid store')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).not.toBeDisabled()
  })

  it('shows a network error message when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<StoreSelector stores={stores} currentStoreId="store-a" />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'store-b')

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
