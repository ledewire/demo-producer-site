import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditContentForm from './EditContentForm'
import { makeContent, makeExternalContent } from '@/test/factories'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
// MarkdownEditor renders a controlled textarea with aria-label="Markdown source"
// and a hidden <input name="content_body">. The real component works fine in
// jsdom so we don't need to stub it — we query via aria-label.

const mockPush = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const defaultItem = makeContent({
  id: 'c1',
  title: 'Original Title',
  price_cents: 299,
  visibility: 'public',
  content_body: btoa('# Hello'),
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EditContentForm', () => {
  it('pre-fills the form with the existing content values', () => {
    render(<EditContentForm id="c1" item={defaultItem} />)

    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Title')
    expect((screen.getByLabelText(/price/i) as HTMLInputElement).value).toBe('2.99')
    expect((screen.getByLabelText(/visibility/i) as HTMLSelectElement).value).toBe('public')
    expect((screen.getByLabelText(/markdown source/i) as HTMLTextAreaElement).value).toBe('# Hello')
  })

  it('decodes a base64 content body correctly', () => {
    const item = makeContent({ content_body: btoa(unescape(encodeURIComponent('# Unicode 🎉'))) })
    render(<EditContentForm id="c1" item={item} />)
    expect((screen.getByLabelText(/markdown source/i) as HTMLTextAreaElement).value).toBe('# Unicode 🎉')
  })

  it('sends a PATCH request with updated values on submit', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
    render(<EditContentForm id="c1" item={defaultItem} />)

    await userEvent.clear(screen.getByLabelText(/title/i))
    await userEvent.type(screen.getByLabelText(/title/i), 'New Title')

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/content/c1',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.title).toBe('New Title')
    expect(typeof body.price_cents).toBe('number')
    expect(typeof body.content_body).toBe('string')
  })

  it('redirects to /content on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
    render(<EditContentForm id="c1" item={defaultItem} />)

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/content'))
  })

  it('shows an error message when the API returns an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Validation failed' }),
    })
    render(<EditContentForm id="c1" item={defaultItem} />)

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Validation failed')
    })
  })

  it('redirects to /login on a 401 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Not authenticated' }),
    })
    render(<EditContentForm id="c1" item={defaultItem} />)

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
  })

  it('validates price: shows error for negative values without fetching', async () => {
    render(<EditContentForm id="c1" item={defaultItem} />)

    await userEvent.clear(screen.getByLabelText(/price/i))
    await userEvent.type(screen.getByLabelText(/price/i), '-5')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid non-negative/)
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('disables the submit button while saving', async () => {
    let resolveFetch!: () => void
    mockFetch.mockReturnValueOnce(
      new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve) => {
        resolveFetch = () => resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
      }),
    )
    render(<EditContentForm id="c1" item={defaultItem} />)

    const btn = screen.getByRole('button', { name: /save changes/i })
    await userEvent.click(btn)

    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Saving…')

    resolveFetch()
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
  })

  it('renders content_uri and external_identifier fields for an external_ref item', () => {
    const externalItem = makeExternalContent({ id: 'c2' })
    render(<EditContentForm id="c2" item={externalItem} />)

    expect(screen.getByLabelText(/content uri/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/external identifier/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/content \(markdown\)/i)).not.toBeInTheDocument()

    expect((screen.getByLabelText(/content uri/i) as HTMLInputElement).value).toBe(
      'https://vimeo.com/987654321',
    )
    expect((screen.getByLabelText(/external identifier/i) as HTMLInputElement).value).toBe(
      'vimeo:987654321',
    )
  })

  it('sends content_uri in PATCH body (no content_body) for an external_ref item', async () => {
    const externalItem = makeExternalContent({ id: 'c2' })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
    render(<EditContentForm id="c2" item={externalItem} />)

    await userEvent.clear(screen.getByLabelText(/content uri/i))
    await userEvent.type(screen.getByLabelText(/content uri/i), 'https://vimeo.com/newvideo')

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.content_type).toBe('external_ref')
    expect(body.content_uri).toBe('https://vimeo.com/newvideo')
    expect(body).not.toHaveProperty('content_body')
  })
})
