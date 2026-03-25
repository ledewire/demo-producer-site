# Repo Notes (for AI assistants)

## Test Patterns

- Mock SDK: `vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))`
- Mock session: `vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))` — factory MUST NOT reference outer vars (vi.mock is hoisted)
- Paginated list mocks must return `{ data: [...], pagination: makePagination(n) }` — never a bare array
- `next/navigation` must always be mocked in client component tests
- Client forms with JS validation: add `noValidate` to `<form>` to prevent browser-native constraint validation from blocking JS validation

## SDK Version: 0.4.0

- `loginWithEmailAndListStores()` / `loginWithGoogleAndListStores()` — single call, returns `{ tokens, stores }`; tokens are raw `MerchantAuthenticationResponse` (snake_case), use `parseExpiresAt()` to convert `expires_at`
- List endpoints return `{ data, pagination }` — always destructure
- `instanceof LedewireError` correctly narrows — no `const e = err as LedewireError` casts needed
- `Content` is a discriminated union on `content_type` — use typed objects, not `Record<string, any>`
- `MerchantInviteRequest.is_author` is required in the type despite `@default true` — pass it explicitly
- See `SDK-FEEDBACK.md` for full list of known issues and workarounds

## Auth Note

- `requireAuth()` in `src/lib/auth.ts` calls `redirect()` — only safe in Server Components, NOT Route Handlers
  (Route Handlers should check session directly and return 401)
- Auth routes create a throw-away SDK client with no storage adapter; tokens are read from `MerchantLoginResult.tokens` directly

## Session stores shape

- `session.stores` is `Array<{ id: string; name: string }>` — matches `MerchantLoginStore` from the combined login helpers
- `ManageableStore` (from `listStores()`) uses `store_id` / `store_name` — different type, different source

## Progress

- All phases complete; SDK upgraded to 0.4.0
- 81 tests passing across 9 test files
