'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

interface Props {
  /** Initial markdown value (plain text, not base64). */
  defaultValue?: string
  /** HTML id for the hidden input — used by <label htmlFor>. */
  id?: string
  required?: boolean
}

/**
 * Split-pane markdown editor.
 *
 * Renders a textarea on the left and a live-rendered preview on the right.
 * Emits a hidden <input name="content_body"> so parent forms can read the
 * raw markdown via FormData without any change to their submit logic.
 */
export default function MarkdownEditor({ defaultValue = '', id = 'content_body', required }: Props) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4 min-h-64">
        {/* Editor pane */}
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Write</span>
          <textarea
            id={id}
            aria-label="Markdown source"
            required={required}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={16}
            placeholder="# Your title&#10;&#10;Write in Markdown..."
            className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono resize-none"
          />
        </div>

        {/* Preview pane */}
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Preview</span>
          <div
            data-testid="markdown-preview"
            className="flex-1 overflow-auto rounded-md border border-gray-200 bg-white p-4 prose prose-sm max-w-none"
          >
            {value.trim() ? (
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-gray-400 italic">Preview will appear here…</p>
            )}
          </div>
        </div>
      </div>

      {/* Hidden input carries the raw markdown value for FormData */}
      <input type="hidden" name="content_body" value={value} />
    </div>
  )
}
