import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarkdownEditor from './MarkdownEditor'

// react-markdown is an async component in v9; replace with a synchronous stub
// so tests render deterministically without needing act() timing.
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="md-render">{children}</div>,
}))
vi.mock('rehype-sanitize', () => ({ default: {} }))

describe('MarkdownEditor', () => {
  it('renders the write textarea and preview pane', () => {
    render(<MarkdownEditor />)
    expect(screen.getByLabelText(/markdown source/i)).toBeInTheDocument()
    expect(screen.getByTestId('markdown-preview')).toBeInTheDocument()
  })

  it('pre-fills the textarea with the defaultValue', () => {
    render(<MarkdownEditor defaultValue="# Hello" />)
    expect((screen.getByLabelText(/markdown source/i) as HTMLTextAreaElement).value).toBe('# Hello')
  })

  it('shows a placeholder when the editor is empty', () => {
    render(<MarkdownEditor defaultValue="" />)
    expect(screen.getByText(/preview will appear here/i)).toBeInTheDocument()
  })

  it('renders the markdown preview as the user types', async () => {
    render(<MarkdownEditor defaultValue="" />)
    const textarea = screen.getByLabelText(/markdown source/i)

    await userEvent.type(textarea, '# Title')

    expect(screen.getByTestId('md-render')).toHaveTextContent('# Title')
  })

  it('keeps the hidden input in sync with the textarea value', async () => {
    render(<MarkdownEditor defaultValue="initial" />)
    const textarea = screen.getByLabelText(/markdown source/i)
    const hidden = document.querySelector('input[name="content_body"]') as HTMLInputElement

    expect(hidden.value).toBe('initial')

    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'updated')

    expect(hidden.value).toBe('updated')
  })

  it('pre-fills the hidden input with the defaultValue on mount', () => {
    render(<MarkdownEditor defaultValue="# Prepopulated" />)
    const hidden = document.querySelector('input[name="content_body"]') as HTMLInputElement
    expect(hidden.value).toBe('# Prepopulated')
  })

  it('accepts a custom id for the textarea', () => {
    render(<MarkdownEditor id="my-editor" />)
    expect(document.getElementById('my-editor')).toBeInTheDocument()
  })
})
