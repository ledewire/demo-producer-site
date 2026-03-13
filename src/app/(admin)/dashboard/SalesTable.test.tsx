import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SalesTable from './SalesTable'

function makeSales(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Article ${i + 1}`,
    total_revenue_cents: (i + 1) * 100,
  }))
}

describe('SalesTable', () => {
  it('shows a no-sales message when the list is empty', () => {
    render(<SalesTable sales={[]} />)
    expect(screen.getByText(/no sales yet/i)).toBeInTheDocument()
  })

  it('renders all sales when they fit on one page', () => {
    render(<SalesTable sales={makeSales(5)} />)
    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.getByText('Article 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /prev/i })).not.toBeInTheDocument()
  })

  it('shows only the first page of sales when there are more than PAGE_SIZE', () => {
    render(<SalesTable sales={makeSales(15)} />)
    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.queryByText('Article 11')).not.toBeInTheDocument()
  })

  it('navigates to the next page', async () => {
    render(<SalesTable sales={makeSales(15)} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Article 11')).toBeInTheDocument()
    expect(screen.queryByText('Article 1')).not.toBeInTheDocument()
  })

  it('shows correct amounts as dollars', () => {
    render(<SalesTable sales={[{ title: 'Intro', total_revenue_cents: 1999 }]} />)
    expect(screen.getByText('$19.99')).toBeInTheDocument()
  })
})
