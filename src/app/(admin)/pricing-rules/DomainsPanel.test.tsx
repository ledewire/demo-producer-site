import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DomainsPanel from './DomainsPanel'
import { makeDomainVerification } from '@/test/factories'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DomainsPanel', () => {
  it('shows empty state when no domains', () => {
    render(<DomainsPanel initialDomains={[]} />)
    expect(screen.getByText(/no domains added yet/i)).toBeInTheDocument()
  })

  it('renders domain names and statuses', () => {
    const verified = makeDomainVerification({ domain: 'example.com', status: 'verified' })
    const pending = makeDomainVerification({
      id: 'domain-002',
      domain: 'other.com',
      status: 'pending',
    })
    render(<DomainsPanel initialDomains={[verified, pending]} />)

    expect(screen.getByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('other.com')).toBeInTheDocument()
    expect(screen.getByText('verified')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('does not show Show DNS button for verified domains', () => {
    const verified = makeDomainVerification({ status: 'verified' })
    render(<DomainsPanel initialDomains={[verified]} />)
    expect(screen.queryByRole('button', { name: /show dns/i })).not.toBeInTheDocument()
  })

  it('shows DNS TXT record details when Show DNS is clicked', () => {
    const pending = makeDomainVerification({
      status: 'pending',
      txt_record_name: '_ledewire-verify.example.com',
      txt_record_value: 'ledewire-verify=abc123',
    })
    render(<DomainsPanel initialDomains={[pending]} />)

    fireEvent.click(screen.getByRole('button', { name: /show dns/i }))

    expect(screen.getByText('_ledewire-verify.example.com')).toBeInTheDocument()
    expect(screen.getByText('ledewire-verify=abc123')).toBeInTheDocument()
  })

  it('hides DNS details when Hide DNS is clicked', () => {
    const pending = makeDomainVerification({ status: 'pending' })
    render(<DomainsPanel initialDomains={[pending]} />)

    fireEvent.click(screen.getByRole('button', { name: /show dns/i }))
    fireEvent.click(screen.getByRole('button', { name: /hide dns/i }))

    expect(screen.queryByText(pending.txt_record_value)).not.toBeInTheDocument()
  })

  it('shows validation error when submitting empty domain', () => {
    render(<DomainsPanel initialDomains={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }))
    expect(screen.getByText(/domain is required/i)).toBeInTheDocument()
  })

  it('adds a domain and shows it in the list', async () => {
    const newDomain = makeDomainVerification({
      id: 'domain-new',
      domain: 'newsite.com',
      status: 'pending',
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 201, json: async () => ({ domain: newDomain }) }),
    )
    render(<DomainsPanel initialDomains={[]} />)

    await userEvent.type(screen.getByLabelText(/domain name/i), 'newsite.com')
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }))

    await waitFor(() => {
      expect(screen.getAllByText('newsite.com').length).toBeGreaterThan(0)
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'newsite.com' }),
    })
  })

  it('auto-expands DNS instructions for a newly added domain', async () => {
    const newDomain = makeDomainVerification({
      id: 'domain-new',
      domain: 'newsite.com',
      status: 'pending',
      txt_record_value: 'ledewire-verify=xyz',
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 201, json: async () => ({ domain: newDomain }) }),
    )
    render(<DomainsPanel initialDomains={[]} />)

    await userEvent.type(screen.getByLabelText(/domain name/i), 'newsite.com')
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }))

    await waitFor(() => {
      expect(screen.getByText('ledewire-verify=xyz')).toBeInTheDocument()
    })
  })

  it('shows error when add API call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Domain already exists' }),
      }),
    )
    render(<DomainsPanel initialDomains={[]} />)

    await userEvent.type(screen.getByLabelText(/domain name/i), 'taken.com')
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }))

    await waitFor(() => {
      expect(screen.getByText(/domain already exists/i)).toBeInTheDocument()
    })
  })

  it('removes a domain from the list', async () => {
    const domain = makeDomainVerification({ id: 'domain-del', domain: 'todelete.com' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) }),
    )
    render(<DomainsPanel initialDomains={[domain]} />)

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(screen.queryByText('todelete.com')).not.toBeInTheDocument()
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/domains/domain-del', { method: 'DELETE' })
  })

  it('shows error when remove API call fails', async () => {
    const domain = makeDomainVerification()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Cannot remove verified domain' }),
      }),
    )
    render(<DomainsPanel initialDomains={[domain]} />)

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(screen.getByText(/cannot remove verified domain/i)).toBeInTheDocument()
    })
  })

  it('redirects to /login when add returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    render(<DomainsPanel initialDomains={[]} />)

    await userEvent.type(screen.getByLabelText(/domain name/i), 'example.com')
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('redirects to /login when remove returns 401', async () => {
    const domain = makeDomainVerification()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    render(<DomainsPanel initialDomains={[domain]} />)

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('shows Refresh Status button when domains exist', () => {
    const domain = makeDomainVerification({ status: 'pending' })
    render(<DomainsPanel initialDomains={[domain]} />)
    expect(screen.getByRole('button', { name: /refresh status/i })).toBeInTheDocument()
  })

  it('does not show Refresh Status button when domain list is empty', () => {
    render(<DomainsPanel initialDomains={[]} />)
    expect(screen.queryByRole('button', { name: /refresh status/i })).not.toBeInTheDocument()
  })

  it('updates domain statuses after refresh', async () => {
    const pending = makeDomainVerification({
      id: 'domain-001',
      domain: 'example.com',
      status: 'pending',
    })
    const verified = { ...pending, status: 'verified' as const }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({ domains: [verified] }) }),
    )
    render(<DomainsPanel initialDomains={[pending]} />)

    expect(screen.getByText('pending')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }))

    await waitFor(() => {
      expect(screen.getByText('verified')).toBeInTheDocument()
      expect(screen.queryByText('pending')).not.toBeInTheDocument()
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/domains')
  })

  it('shows error when refresh API call fails', async () => {
    const domain = makeDomainVerification({ status: 'pending' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Service unavailable' }),
      }),
    )
    render(<DomainsPanel initialDomains={[domain]} />)

    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }))

    await waitFor(() => {
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument()
    })
  })

  it('redirects to /login when refresh returns 401', async () => {
    const domain = makeDomainVerification({ status: 'pending' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    render(<DomainsPanel initialDomains={[domain]} />)

    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('shows Check Now button for pending domains', () => {
    const pending = makeDomainVerification({ status: 'pending' })
    render(<DomainsPanel initialDomains={[pending]} />)
    expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument()
  })

  it('shows Check Now button for failed domains', () => {
    const failed = makeDomainVerification({ status: 'failed' })
    render(<DomainsPanel initialDomains={[failed]} />)
    expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument()
  })

  it('does not show Check Now button for verified domains', () => {
    const verified = makeDomainVerification({ status: 'verified' })
    render(<DomainsPanel initialDomains={[verified]} />)
    expect(screen.queryByRole('button', { name: /check now/i })).not.toBeInTheDocument()
  })

  it('triggers verify then refreshes the list on Check Now', async () => {
    const pending = makeDomainVerification({
      id: 'domain-001',
      domain: 'example.com',
      status: 'pending',
    })
    const verified = { ...pending, status: 'verified' as const }
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ queued: true, domain: 'example.com', status: 'pending' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ domains: [verified] }),
      })
    vi.stubGlobal('fetch', mockFetch)
    render(<DomainsPanel initialDomains={[pending]} />)

    fireEvent.click(screen.getByRole('button', { name: /check now/i }))

    await waitFor(() => {
      expect(screen.getByText('verified')).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/domains/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/domains')
  })

  it('shows error when verify API call fails', async () => {
    const pending = makeDomainVerification({ status: 'pending' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Domain not found' }),
      }),
    )
    render(<DomainsPanel initialDomains={[pending]} />)

    fireEvent.click(screen.getByRole('button', { name: /check now/i }))

    await waitFor(() => {
      expect(screen.getByText(/domain not found/i)).toBeInTheDocument()
    })
  })

  it('redirects to /login when verify returns 401', async () => {
    const pending = makeDomainVerification({ status: 'pending' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    render(<DomainsPanel initialDomains={[pending]} />)

    fireEvent.click(screen.getByRole('button', { name: /check now/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})
