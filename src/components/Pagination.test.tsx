import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pagination from './Pagination'

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPrev={vi.fn()} onNext={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the current page and total', () => {
    render(<Pagination page={2} totalPages={5} onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
  })

  it('disables Prev on the first page', () => {
    render(<Pagination page={1} totalPages={3} onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
  })

  it('disables Next on the last page', () => {
    render(<Pagination page={3} totalPages={3} onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /prev/i })).not.toBeDisabled()
  })

  it('calls onPrev when Prev is clicked', async () => {
    const onPrev = vi.fn()
    render(<Pagination page={2} totalPages={3} onPrev={onPrev} onNext={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /prev/i }))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when Next is clicked', async () => {
    const onNext = vi.fn()
    render(<Pagination page={1} totalPages={3} onPrev={vi.fn()} onNext={onNext} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
