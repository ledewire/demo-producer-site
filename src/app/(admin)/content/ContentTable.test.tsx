import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContentTable from './ContentTable'
import { makeContent } from '@/test/factories'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// Mock next/link — just render an <a> tag in the test environment
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
})

function makeItems() {
  return [
    makeContent({ id: 'c1', title: 'Article One', price_cents: 299, visibility: 'public' }),
    makeContent({ id: 'c2', title: 'Article Two', price_cents: 999, visibility: 'private' }),
  ]
}

describe('ContentTable', () => {
  it('renders all content items in the table', () => {
    render(<ContentTable initialItems={makeItems()} />)

    expect(screen.getByText('Article One')).toBeInTheDocument()
    expect(screen.getByText('Article Two')).toBeInTheDocument()
    expect(screen.getByText('$2.99')).toBeInTheDocument()
    expect(screen.getByText('$9.99')).toBeInTheDocument()
  })

  it('renders visibility badges with correct labels', () => {
    render(<ContentTable initialItems={makeItems()} />)

    expect(screen.getByText('public')).toBeInTheDocument()
    expect(screen.getByText('private')).toBeInTheDocument()
  })

  it('renders an Edit link pointing to the correct edit route', () => {
    render(<ContentTable initialItems={makeItems()} />)

    const links = screen.getAllByRole('link', { name: 'Edit' })
    expect(links[0]).toHaveAttribute('href', '/content/c1/edit')
    expect(links[1]).toHaveAttribute('href', '/content/c2/edit')
  })

  it('prompts for confirmation before deleting', async () => {
    render(<ContentTable initialItems={makeItems()} />)

    await userEvent.click(screen.getByRole('button', { name: /delete article one/i }))

    // Inline confirmation UI should appear
    expect(screen.getByText('Delete?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm delete article one/i })).toBeInTheDocument()

    // Clicking No cancels without calling the API
    await userEvent.click(screen.getByRole('button', { name: /cancel delete article one/i }))

    expect(screen.queryByText('Delete?')).not.toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('removes the row optimistically after a successful delete', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    render(<ContentTable initialItems={makeItems()} />)

    await userEvent.click(screen.getByRole('button', { name: /delete article one/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete article one/i }))

    await waitFor(() => {
      expect(screen.queryByText('Article One')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Article Two')).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledWith('/api/content/c1', { method: 'DELETE' })
  })

  it('shows an error message when the delete API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })
    render(<ContentTable initialItems={makeItems()} />)

    await userEvent.click(screen.getByRole('button', { name: /delete article one/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete article one/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error')
    })
    // Row should still be present after failure
    expect(screen.getByText('Article One')).toBeInTheDocument()
  })

  it('shows a network error message when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<ContentTable initialItems={makeItems()} />)

    await userEvent.click(screen.getByRole('button', { name: /delete article one/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm delete article one/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    })
  })

  it('disables the delete button while a delete is in progress', async () => {
    let resolveFetch!: () => void
    mockFetch.mockReturnValueOnce(
      new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
        resolveFetch = () => resolve({ ok: true, json: async () => ({ ok: true }) })
      }),
    )
    render(<ContentTable initialItems={makeItems()} />)

    await userEvent.click(screen.getByRole('button', { name: /delete article one/i }))

    // Confirm the delete to initiate the request
    await userEvent.click(screen.getByRole('button', { name: /confirm delete article one/i }))

    // After confirming, the button re-renders in disabled/deleting state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete article one/i })).toBeDisabled()
    })

    resolveFetch()
    await waitFor(() => expect(screen.queryByText('Article One')).not.toBeInTheDocument())
  })
})

// ── Pagination ────────────────────────────────────────────────────────────

describe('ContentTable pagination', () => {
  function makeItems(count: number) {
    return Array.from({ length: count }, (_, i) =>
      makeContent({ id: `item-${i}`, title: `Article ${i + 1}` }),
    )
  }

  it('shows no pagination controls when all items fit on one page', () => {
    render(<ContentTable initialItems={makeItems(5)} />)
    expect(screen.queryByRole('button', { name: /prev/i })).not.toBeInTheDocument()
  })

  it('shows pagination controls when items exceed one page', () => {
    render(<ContentTable initialItems={makeItems(11)} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('shows only the first page of items initially', () => {
    render(<ContentTable initialItems={makeItems(15)} />)
    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.queryByText('Article 11')).not.toBeInTheDocument()
  })

  it('advances to the next page on Next click', async () => {
    render(<ContentTable initialItems={makeItems(15)} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Article 11')).toBeInTheDocument()
    expect(screen.queryByText('Article 1')).not.toBeInTheDocument()
  })

  it('goes back to the previous page on Prev click', async () => {
    render(<ContentTable initialItems={makeItems(15)} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /prev/i }))
    expect(screen.getByText('Article 1')).toBeInTheDocument()
  })
})

// ── Search ────────────────────────────────────────────────────────────────

describe('ContentTable search', () => {
  it('filters items by title (case-insensitive)', async () => {
    render(<ContentTable initialItems={makeItems()} />)
    await userEvent.type(screen.getByRole('searchbox'), 'one')
    expect(screen.getByText('Article One')).toBeInTheDocument()
    expect(screen.queryByText('Article Two')).not.toBeInTheDocument()
  })

  it('shows all items when the search input is cleared', async () => {
    render(<ContentTable initialItems={makeItems()} />)
    const input = screen.getByRole('searchbox')
    await userEvent.type(input, 'one')
    await userEvent.clear(input)
    expect(screen.getByText('Article One')).toBeInTheDocument()
    expect(screen.getByText('Article Two')).toBeInTheDocument()
  })

  it('shows an empty table when no items match the query', async () => {
    render(<ContentTable initialItems={makeItems()} />)
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.queryByText('Article One')).not.toBeInTheDocument()
    expect(screen.queryByText('Article Two')).not.toBeInTheDocument()
  })

  it('resets to page 1 when the search query changes', async () => {
    const lotsOfItems = Array.from({ length: 15 }, (_, i) =>
      makeContent({ id: `cx${i}`, title: i < 10 ? `Alpha ${i}` : `Beta ${i}` }),
    )
    render(<ContentTable initialItems={lotsOfItems} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Beta 10')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'Alpha')
    expect(screen.getByText('Alpha 0')).toBeInTheDocument()
    expect(screen.queryByText('Beta 10')).not.toBeInTheDocument()
  })
})
