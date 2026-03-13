interface Props {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

/**
 * Simple prev/next pagination bar.
 * All data lives in the caller — this component is purely presentational.
 */
export default function Pagination({ page, totalPages, onPrev, onNext }: Props) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm text-gray-600">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
        >
          ← Prev
        </button>
        <button
          onClick={onNext}
          disabled={page === totalPages}
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
