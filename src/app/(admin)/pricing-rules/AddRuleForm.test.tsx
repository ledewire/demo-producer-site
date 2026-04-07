import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddRuleForm from './AddRuleForm'
import { makeDomainVerification } from '@/test/factories'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

const verifiedDomain = makeDomainVerification({ status: 'verified' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AddRuleForm', () => {
  it('disables the submit button when no verified domains', () => {
    render(<AddRuleForm verifiedDomains={[]} />)
    expect(screen.getByRole('button', { name: /create rule/i })).toBeDisabled()
    expect(screen.getByText(/must verify at least one domain/i)).toBeInTheDocument()
  })

  it('shows validation error when url_pattern is empty', async () => {
    render(<AddRuleForm verifiedDomains={[verifiedDomain]} />)

    fireEvent.click(screen.getByRole('button', { name: /create rule/i }))

    expect(screen.getByText(/url pattern is required/i)).toBeInTheDocument()
  })

  it('shows validation error when url_pattern does not start with http', async () => {
    render(<AddRuleForm verifiedDomains={[verifiedDomain]} />)

    await userEvent.type(screen.getByLabelText(/url pattern/i), 'ftp://bad.com/*')
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }))

    expect(screen.getByText(/http/i)).toBeInTheDocument()
  })

  it('shows validation error when price is invalid', async () => {
    render(<AddRuleForm verifiedDomains={[verifiedDomain]} />)

    await userEvent.type(screen.getByLabelText(/url pattern/i), 'https://example.com/*')
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }))

    expect(screen.getByText(/non-negative/i)).toBeInTheDocument()
  })

  it('submits correct payload and shows success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ rule: {} }) }),
    )
    render(<AddRuleForm verifiedDomains={[verifiedDomain]} />)

    await userEvent.type(screen.getByLabelText(/url pattern/i), 'https://example.com/articles/*')
    await userEvent.type(screen.getByLabelText(/price/i), '1.50')
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }))

    await waitFor(() => {
      expect(screen.getByText(/pricing rule created/i)).toBeInTheDocument()
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/pricing-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url_pattern: 'https://example.com/articles/*', price_cents: 150 }),
    })
  })

  it('shows error message on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Domain not verified' }),
      }),
    )
    render(<AddRuleForm verifiedDomains={[verifiedDomain]} />)

    await userEvent.type(screen.getByLabelText(/url pattern/i), 'https://example.com/*')
    await userEvent.type(screen.getByLabelText(/price/i), '1')
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }))

    await waitFor(() => {
      expect(screen.getByText(/domain not verified/i)).toBeInTheDocument()
    })
  })

  it('accepts a price of 0 (free access)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ rule: {} }) }),
    )
    render(<AddRuleForm verifiedDomains={[verifiedDomain]} />)

    await userEvent.type(screen.getByLabelText(/url pattern/i), 'https://example.com/*')
    await userEvent.type(screen.getByLabelText(/price/i), '0')
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }))

    await waitFor(() => {
      expect(screen.getByText(/pricing rule created/i)).toBeInTheDocument()
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/pricing-rules',
      expect.objectContaining({
        body: JSON.stringify({ url_pattern: 'https://example.com/*', price_cents: 0 }),
      }),
    )
  })

  it('redirects to /login when the API returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    render(<AddRuleForm verifiedDomains={[verifiedDomain]} />)

    await userEvent.type(screen.getByLabelText(/url pattern/i), 'https://example.com/*')
    await userEvent.type(screen.getByLabelText(/price/i), '1')
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})
