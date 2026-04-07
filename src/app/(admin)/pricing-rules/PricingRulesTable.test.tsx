import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PricingRulesTable from './PricingRulesTable'
import { makePricingRule } from '@/test/factories'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PricingRulesTable', () => {
  it('shows empty state when no active rules', () => {
    render(<PricingRulesTable initialRules={[]} />)
    expect(screen.getByText(/no active pricing rules/i)).toBeInTheDocument()
  })

  it('renders active rules', () => {
    const rule = makePricingRule({
      url_pattern: 'https://example.com/articles/*',
      price_cents: 150,
    })
    render(<PricingRulesTable initialRules={[rule]} />)

    expect(screen.getByText('https://example.com/articles/*')).toBeInTheDocument()
    expect(screen.getByText('$1.50')).toBeInTheDocument()
  })

  it('hides inactive rules', () => {
    const inactive = makePricingRule({ active: false })
    render(<PricingRulesTable initialRules={[inactive]} />)
    expect(screen.getByText(/no active pricing rules/i)).toBeInTheDocument()
  })

  it('calls deactivate API and removes rule from table', async () => {
    const rule = makePricingRule({ id: 'rule-123' })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ rule: { ...rule, active: false } }),
        }),
    )
    render(<PricingRulesTable initialRules={[rule]} />)

    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(screen.getByText(/no active pricing rules/i)).toBeInTheDocument()
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/pricing-rules/rule-123', {
      method: 'DELETE',
    })
  })

  it('shows error message on deactivate failure', async () => {
    const rule = makePricingRule()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Cannot deactivate rule' }),
      }),
    )
    render(<PricingRulesTable initialRules={[rule]} />)

    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(screen.getByText(/cannot deactivate rule/i)).toBeInTheDocument()
    })
  })

  it('displays $0.00 for a free-access rule', () => {
    const rule = makePricingRule({ price_cents: 0 })
    render(<PricingRulesTable initialRules={[rule]} />)
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('redirects to /login when deactivate returns 401', async () => {
    const rule = makePricingRule()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    render(<PricingRulesTable initialRules={[rule]} />)

    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})
