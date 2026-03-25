# GitHub Copilot — Workspace Instructions

## What this project is

A Next.js 15 merchant admin site backed by `@ledewire/node` (currently **0.5.0**).
Merchants log in (email/password or Google), then manage content, view sales, and invite authors.
No API key is stored server-side — all SDK calls use the merchant JWT from the iron-session cookie.

## Stack

- **Next.js 15 App Router** — server components fetch data; client components handle mutations
- **TypeScript strict mode** — no `any`, no suppression comments without justification
- **`@ledewire/node` SDK** — all LedeWire API calls go through the SDK, never raw `fetch`
- **`iron-session`** — encrypted httpOnly cookie; `SameSite=Strict`
- **Vitest + React Testing Library** — run with `npm test`; typecheck with `npm run typecheck`

## Key conventions

### Auth

- `requireAuth()` in `src/lib/auth.ts` — use in **Server Components** only; calls `redirect()`
- Route Handlers must check the session directly and return `{ status: 401 }` — never call `requireAuth()`
- `createMerchantClient()` in `src/lib/ledewire.ts` — creates a fully configured SDK client with the session's TokenStorage adapter; use this in all Route Handlers and Server Components
- **`TokenStorage.clearTokens` caveat** — `session.destroy()` throws in Server Component context (Next.js 15.2+). The adapter wraps it in try/catch and falls back to nulling session fields; `requireAuth()` handles the redirect on the next request.
- Login routes (`/api/auth/login`, `/api/auth/google`) create a **temporary** throwaway client (no storage adapter needed — tokens come back in `MerchantLoginResult`)

### SDK patterns (0.5.0+)

- Use `loginWithEmailAndListStores()` / `loginWithGoogleAndListStores()` in auth routes — single call, returns `{ tokens, stores }`
- Tokens from login come back as `StoredTokens` (camelCase, `expiresAt` as Unix ms) — assign `tokens.accessToken`, `tokens.refreshToken`, `tokens.expiresAt` directly; `parseExpiresAt` is no longer needed
- All list methods (`seller.content.list`, `merchant.sales.list`, etc.) return `{ data, pagination }` — always destructure
- `instanceof LedewireError` correctly narrows in strict TS — no `err as LedewireError` casts needed
- `Content` is a discriminated union on `content_type` — build typed objects, not `Record<string, any>`
- `ForbiddenError` (extends `LedewireError`) is thrown when valid credentials have no merchant role — catch it before `LedewireError` to return `403`

### Testing

- **SDK mock:** `vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))`
  The mock uses `createMockClient(vi.fn)` from `@ledewire/node/testing`, wrapped with `vi.mocked(..., true)` to surface `mockResolvedValueOnce` etc.
- **Session mock:** `vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))` — factory body MUST NOT reference outer-scope variables (vi.mock is hoisted)
- **Paginated list mocks** must return `{ data: [...], pagination: makePagination(n) }` — never a bare array
- `next/navigation` must always be mocked in client component tests
- Forms with JS validation: add `noValidate` to `<form>` to prevent browser-native constraint validation from interfering

### Session data shape

```ts
interface SessionData {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  storeId?: string | null
  stores?: Array<{ id: string; name: string }> // MerchantLoginStore shape
}
```

### Error handling in Route Handlers

```ts
// Correct pattern — no explicit casts needed in 0.5.0+
// Check ForbiddenError before LedewireError (it is a subclass)
if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
if (err instanceof AuthError) return NextResponse.json({ error: '...' }, { status: 401 })
if (err instanceof LedewireError)
  return NextResponse.json({ error: err.message }, { status: err.statusCode })
throw err
```

## SDK known issues (0.5.0)

- `createMockClient` returns plain function signatures, not `vi.MockedFunction` — wrap with `vi.mocked(createMockClient(vi.fn), true)` to surface `.mockResolvedValueOnce` etc.

## Feedback

SDK issues are tracked in `SDK-FEEDBACK.md`. Update that file when new workarounds are needed or when SDK fixes land.
