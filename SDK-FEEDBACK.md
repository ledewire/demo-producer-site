# @ledewire/node SDK — Feedback & Improvement Notes

Collected during development of the demo producer site (Next.js 15, strict TypeScript).
Items are categorised by severity: 🔴 Bug/Breaking · 🟡 DX Friction · 🟢 Nice-to-have
Resolved items are marked ✅ with the version they were fixed in.

---

## ✅ FIXED in 0.4.0 — `@ledewire/core` type declarations not bundled

All re-exported types are now inlined into `dist/index.d.ts`. `instanceof LedewireError`
correctly narrows `unknown` in strict mode — no more explicit `err as LedewireError` casts.
The silent `MerchantSaleResponse → any` field-name bug is now a compile-time error.

---

## ✅ FIXED in 0.4.0 — Two-step login + store discovery

`loginWithEmailAndListStores()` and `loginWithGoogleAndListStores()` now return `{ tokens, stores }`
in a single HTTP call. The two-step `loginWithEmail` → `listStores` pattern and the
`capturedTokens` workaround are gone.

---

## ✅ FIXED in 0.4.0 — `content_type` untyped string

`Content` is now a proper discriminated union on `content_type`. `visibility` is also typed
as `'public' | 'unlisted'`. The `Record<string, any>` payload workaround is removed.

---

## ✅ FIXED in 0.4.0 — `ManageableStore` missing human-readable name

`ManageableStore` now includes `store_name`. The store-selector dropdown can show real names.

---

## ✅ FIXED in 0.4.0 — `content.search()` metadata-only

`ContentSearchRequest` now accepts `title` (case-insensitive partial match) and `uri` alongside
`metadata`. Title search is the most useful search for most UIs.

---

## ✅ FIXED in 0.4.0 — No pagination on list endpoints

All list methods now accept `PaginationParams` and return `{ data, pagination }`. Server-side
paging replaces the previous full-dataset fetch + client-side slice workaround.

---

## ✅ FIXED in 0.4.0 — No test utilities

`@ledewire/node/testing` exports `createMockClient(vi.fn)`. The hand-rolled namespace mock is
replaced with typed SDK stubs. See new friction item below for a remaining rough edge.

---

## ✅ FIXED in 0.4.0 — `MemoryTokenStorage` serverless warning missing

The `storage` JSDoc now warns about cold-start token loss and includes a cookie/Redis example.

---

## ✅ FIXED in 0.5.0 — `MerchantLoginResult.tokens` is raw API shape, not `StoredTokens`

`MerchantLoginResult.tokens` is now typed as `StoredTokens` (camelCase fields, `expiresAt` as
Unix ms timestamp). The `access_token` / `refresh_token` / `expires_at` remapping and the
`parseExpiresAt()` call are no longer needed. Auth routes now assign `tokens.accessToken`,
`tokens.refreshToken`, and `tokens.expiresAt` directly.

---

## ✅ FIXED in 0.5.0 — `ContentListItem` omits `content_uri`; external content links impossible in list views

`ContentListItem` now includes `content_uri: string | null`. For buyers, the URI is gated:
it is only present when `access_info.has_purchased` is `true`, so the external link is not
exposed to unpurchased buyers. Seller list endpoints (which require owner/author auth) always
return the URI, eliminating the N+1 `content.get()` workaround for list views.

---

## ✅ FIXED in 0.5.0 — `MerchantLoginStore` and `ManageableStore` have inconsistent field names

`ManageableStore` now uses `id` / `name` (matching `MerchantLoginStore`). Both types that
represent "a store accessible to this merchant" now share the same field names.

---

## 🟡 New — `createMockClient` returns plain functions, not `vi.MockedFunction`

**Versions affected:** 0.4.0

`createMockClient(vi.fn)` pre-stubs all methods, but the returned `MockNodeClient` type exposes
methods as plain function signatures. To call `.mockResolvedValueOnce()`, `.mock.calls`, etc.,
consumers must wrap with `vi.mocked()`:

```ts
// Required workaround:
const mockClient = vi.mocked(createMockClient(vi.fn), true)
```

Without the `vi.mocked()` call, TypeScript reports:

```
Property 'mockResolvedValueOnce' does not exist on type '(...) => Promise<...>'
```

The `createMockClient` JSDoc example doesn't show this step — it demonstrates calling
`vi.mocked(client.merchant.sales.list).mockResolvedValue(...)` but doesn't explain why the
intermediate `vi.mocked(createMockClient(...), true)` call at the top level is also needed.

**Recommended fix:** Either type the returned object as `DeepMocked<NodeClient>` (using
`MockedDeep` from `vitest`), or add a note to the JSDoc explaining that the top-level
`vi.mocked(client, true)` call is necessary to surface mock assertion methods.

---

## ✅ NEW in 0.5.0 — `client.config.getPublic()` exposes `google_client_id`

`client.config.getPublic()` (no auth required) now returns `{ google_client_id?: string }`.
This eliminates the need for a `NEXT_PUBLIC_GOOGLE_CLIENT_ID` environment variable:

- The login page fetches the value at render time to decide whether to show the Google Sign-In button.
- The Google auth route uses it for the defence-in-depth audience check before delegating to the SDK.

Both call sites previously required an env var to be configured manually; they now consume the
value directly from the API with no additional deployment configuration.

---

## ✅ FIXED in 0.5.0 — `MerchantInviteRequest.is_author` required but documented as defaulting to `true`

`is_author` is now `optional` in `MerchantInviteRequest`. The explicit `is_author: true` at
every call site is no longer needed.

---

## 🟡 DX — `onTokenRefreshed` and `storage.setTokens` overlap (partially addressed in 0.4.0)

The 0.4.0 JSDoc now clearly states that `storage.setTokens` is the canonical persistence hook
and `onTokenRefreshed` is for side-effects only. This is an improvement. However, both hooks
still exist on `NodeClientConfig` and fire for the same event. Any consumer who provides both
will silently double-write.

**Remaining recommendation:** Consider a deprecation notice on `onTokenRefreshed` pointing
to `storage.setTokens`, or emit a console warning in development if both are provided at once.

---

## 🟡 DX — `snake_case` field naming throughout

All SDK response objects use `snake_case` (`store_id`, `access_token`, `price_cents`). This is
consistent with the REST wire format but creates friction in TypeScript/JavaScript where
`camelCase` is idiomatic — and it means the normalized `StoredTokens` type (camelCase) lives
alongside raw response types (snake_case) with no clear rule about when each applies.

**Suggestion:** Offer camelCase aliases or a `transformKeys` option on `createClient`. Low
priority — consistency with the wire format is a valid choice — but worth noting.

---

## 🟢 Nice-to-have — No `createClient` example in README for merchant-only (no API key) auth

The `createClient` JSDoc example covers API key + secret auth. The merchant JWT flow (covering
the combined login helpers, the `storage` adapter, and `onAuthExpired`) is only shown in the
`NodeClientConfig` JSDoc. A dedicated README section for this flow would reduce setup time for
producers who don't use API keys.

---

## ✅ FIXED in 0.5.0 — Store config endpoint (`google_client_id`) requires auth, but is needed _before_ auth

`client.config.getPublic()` is now available, returning `PublicConfigResponse` (includes
`google_client_id`) with no authentication required. This breaks the circular dependency.

The login page (`page.tsx`) is now a server component that calls `client.config.getPublic()`
and passes `googleClientId` down to the `LoginForm` client component. `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
is no longer used.

---

## ✅ FIXED in 0.5.0 — Merchant auth returns opaque `"invalid role"` error

The SDK now throws `ForbiddenError` (a `403`) with the message
`"This account does not have merchant access. Use a merchant or owner account."` when a valid
buyer account attempts merchant login. The auth routes now catch `ForbiddenError` explicitly
and return a `403` with `err.message` to surface it to the client.

---

## ✅ FIXED in 0.7.0 — No password reset support

`client.merchant.auth.requestPasswordReset({ email })` sends a 6-digit reset code to the
merchant's email. `client.merchant.auth.resetPassword({ email, reset_code, password })` applies
the new password. Both are unauthenticated calls (throwaway `createClient`, no storage
adapter needed). New types exported: `MerchantPasswordResetRequestBody`,
`MerchantPasswordResetBody`, `MerchantPasswordResetResponse`.

---
