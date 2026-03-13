# Repo Notes (for AI assistants)

## Test Patterns
- Mock SDK: `vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))`
- Mock session: `vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))` — factory MUST NOT reference outer vars (vi.mock is hoisted)
- `next/navigation` must always be mocked in client component tests
- Client forms with JS validation: add `noValidate` to `<form>` to prevent browser-native constraint validation from blocking JS validation

## SDK Quirks
- `@ledewire/core` types resolve to `any` — use `const e = err as LedewireError` after instanceof guard
- README says `stores[0].id` but actual field is `stores[0].store_id`

## Auth Note
- `requireAuth()` in `src/lib/auth.ts` calls `redirect()` — only safe in Server Components, NOT Route Handlers
  (Route Handlers should check session directly and return 401)

## Progress
- Phase 2+3 complete: content CRUD, store selector, error boundary, auth hardening
- 43 tests passing across 5 test files
- Phase 4 next: markdown preview, pagination, search
