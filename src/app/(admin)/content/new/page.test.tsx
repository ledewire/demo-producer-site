import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewContentPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

// MarkdownEditor uses a hidden input named content_body — mock it simply
vi.mock('@/components/MarkdownEditor', () => ({
  default: ({ id, required }: { id: string; required?: boolean }) => (
    <textarea id={id} name={id} required={required} aria-label="Content (Markdown)" />
  ),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function okResponse(body: unknown = { ok: true, content: { id: 'new-1' } }) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
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

// ── Rendering ────────────────────────────────────────────────────────────────

describe('NewContentPage rendering', () => {
  it('renders the form with markdown fields by default', () => {
    render(<NewContentPage />)
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Price (USD)')).toBeInTheDocument()
    expect(screen.getByLabelText(/Content \(Markdown\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    // external_ref fields should not be present
    expect(screen.queryByLabelText('Content URI')).not.toBeInTheDocument()
  })

  it('switches to external_ref fields when content type is changed', async () => {
    render(<NewContentPage />)

    await userEvent.selectOptions(
      screen.getByLabelText('Content type'),
      'External reference (video, PDF, link…)',
    )

    expect(screen.getByLabelText('Content URI')).toBeInTheDocument()
    expect(screen.getByLabelText(/External identifier/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Content \(Markdown\)/)).not.toBeInTheDocument()
  })
})

// ── Markdown form submission ─────────────────────────────────────────────

describe('NewContentPage markdown submission', () => {
  it('submits a markdown article and redirects to /content on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<NewContentPage />)

    await userEvent.clear(screen.getByLabelText('Title'))
    await userEvent.type(screen.getByLabelText('Title'), 'My Article')
    await userEvent.clear(screen.getByLabelText('Price (USD)'))
    await userEvent.type(screen.getByLabelText('Price (USD)'), '4.99')
    await userEvent.type(screen.getByLabelText(/Content \(Markdown\)/), '# Hello')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/content'))
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/content',
      expect.objectContaining({ method: 'POST' }),
    )
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(sentBody.content_type).toBe('markdown')
    expect(sentBody.title).toBe('My Article')
    expect(sentBody.price_cents).toBe(499)
    // content_body should be base64-encoded
    expect(typeof sentBody.content_body).toBe('string')
    expect(atob(sentBody.content_body)).toBe('# Hello')
  })

  it('shows a validation error for a negative price without calling the API', async () => {
    render(<NewContentPage />)

    await userEvent.type(screen.getByLabelText('Title'), 'My Article')
    await userEvent.clear(screen.getByLabelText('Price (USD)'))
    await userEvent.type(screen.getByLabelText('Price (USD)'), '-1')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/non-negative/))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows a validation error for a non-numeric price without calling the API', async () => {
    render(<NewContentPage />)

    await userEvent.type(screen.getByLabelText('Title'), 'My Article')
    await userEvent.clear(screen.getByLabelText('Price (USD)'))
    await userEvent.type(screen.getByLabelText('Price (USD)'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/non-negative/))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows an API error message on a failed response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Validation failed' }))
    render(<NewContentPage />)

    await userEvent.type(screen.getByLabelText('Title'), 'My Article')
    await userEvent.type(screen.getByLabelText(/Content \(Markdown\)/), '# Hello')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Validation failed'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to /login on a 401 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse({ error: 'Unauthorized' }, 401))
    render(<NewContentPage />)

    await userEvent.type(screen.getByLabelText('Title'), 'My Article')
    await userEvent.type(screen.getByLabelText(/Content \(Markdown\)/), '# Hello')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
  })

  it('disables the Publish button while the request is in flight', async () => {
    let resolve!: () => void
    mockFetch.mockReturnValueOnce(new Promise((r) => (resolve = () => r(okResponse()))))
    render(<NewContentPage />)

    await userEvent.type(screen.getByLabelText('Title'), 'My Article')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    expect(screen.getByRole('button', { name: /Publishing/ })).toBeDisabled()
    resolve()
  })
})

// ── External ref form submission ─────────────────────────────────────────

describe('NewContentPage external_ref submission', () => {
  it('submits an external_ref item with URI and identifier', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<NewContentPage />)

    await userEvent.selectOptions(
      screen.getByLabelText('Content type'),
      'External reference (video, PDF, link…)',
    )
    await userEvent.type(screen.getByLabelText('Title'), 'My Video')
    await userEvent.clear(screen.getByLabelText('Price (USD)'))
    await userEvent.type(screen.getByLabelText('Price (USD)'), '9.99')
    await userEvent.type(screen.getByLabelText('Content URI'), 'https://vimeo.com/987654321')
    await userEvent.type(screen.getByLabelText(/External identifier/), 'vimeo:987654321')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/content'))
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(sentBody.content_type).toBe('external_ref')
    expect(sentBody.content_uri).toBe('https://vimeo.com/987654321')
    expect(sentBody.external_identifier).toBe('vimeo:987654321')
    expect(sentBody.price_cents).toBe(999)
  })

  it('omits external_identifier when the field is left blank', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    render(<NewContentPage />)

    await userEvent.selectOptions(
      screen.getByLabelText('Content type'),
      'External reference (video, PDF, link…)',
    )
    await userEvent.type(screen.getByLabelText('Title'), 'My Video')
    await userEvent.clear(screen.getByLabelText('Price (USD)'))
    await userEvent.type(screen.getByLabelText('Price (USD)'), '9.99')
    await userEvent.type(screen.getByLabelText('Content URI'), 'https://vimeo.com/987654321')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/content'))
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect('external_identifier' in sentBody).toBe(false)
  })
})

// ── Cancel ───────────────────────────────────────────────────────────────────

describe('NewContentPage cancel', () => {
  it('calls router.back() when Cancel is clicked', async () => {
    render(<NewContentPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockBack).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
