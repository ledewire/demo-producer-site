# LedeWire Demo Producer Site — Implementation Plan

A Next.js 15 merchant admin app backed by the `@ledewire/node` SDK.
Merchants log in with email/password or Google, then manage content and invite authors.
No API key or secret is stored — all operations run on the merchant auth token.

---

## Architecture Decisions

| Concern         | Decision                                                      | Rationale                                                              |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Framework       | Next.js 15 (App Router)                                       | Server Components for data fetching, Route Handlers for API            |
| Auth strategy   | `client.merchant.auth.loginWithEmail()` / `loginWithGoogle()` | No API key/secret needed; merchant token sufficient for all operations |
| Session storage | `iron-session` encrypted httpOnly cookie                      | Tokens never exposed to client JS; survives page reload                |
| Token refresh   | SDK `TokenStorage` adapter writes back to the cookie          | Transparent — no manual refresh logic needed                           |
| Styling         | Tailwind CSS + `@tailwindcss/forms`                           | Utility-first; no component library dependency                         |
| Dev environment | VS Code devcontainer (Node 20, TypeScript, ESLint, Prettier)  | Reproducible in Codespaces or locally                                  |

---

## Current State (what has been scaffolded)

### Config & Tooling

- [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json) — Node 20 container, port 3000 forwarded, VS Code extensions pre-installed
- [`package.json`](package.json) — Next.js 15, `@ledewire/node ^0.4.0`, `iron-session`, Tailwind
- [`tsconfig.json`](tsconfig.json) — strict mode, `@/*` path alias
- [`.env.example`](.env.example) — documents all required env vars
- [`.gitignore`](.gitignore), [`.prettierrc.json`](.prettierrc.json), [`postcss.config.mjs`](postcss.config.mjs), [`tailwind.config.ts`](tailwind.config.ts)

### Core Library (`src/lib/`)

- [`session.ts`](src/lib/session.ts) — `getSession()` wrapping `iron-session`; validates `SESSION_SECRET` at runtime
- [`ledewire.ts`](src/lib/ledewire.ts) — `createMerchantClient()`: constructs a `@ledewire/node` client with a `TokenStorage` adapter that reads/writes the session cookie; no API key required
- [`auth.ts`](src/lib/auth.ts) — `requireAuth()`: guards Server Components and Route Handlers; redirects to `/login` if unauthenticated

### Middleware (`src/middleware.ts`)

- Cookie-presence check on all `/dashboard`, `/content`, `/users` paths
- Redirects to `/login?from=<path>` when the session cookie is absent

### API Routes (`src/app/api/`)

| Route                      | Method | Purpose                                                   |
| -------------------------- | ------ | --------------------------------------------------------- |
| `/api/auth/login`          | POST   | Email/password login → sets session cookie                |
| `/api/auth/google`         | POST   | Google `id_token` login → sets session cookie             |
| `/api/auth/logout`         | POST   | Destroys session cookie                                   |
| `/api/content`             | GET    | List all content items for the active store               |
| `/api/content`             | POST   | Create a new content item (seller API via merchant token) |
| `/api/content/[contentId]` | GET    | Fetch a single content item                               |
| `/api/content/[contentId]` | PATCH  | Update a content item (sparse fields)                     |
| `/api/content/[contentId]` | DELETE | Delete a content item                                     |
| `/api/stores/select`       | POST   | Switch active store in session                            |
| `/api/users`               | POST   | Invite a user to the store                                |
| `/api/users/[userId]`      | DELETE | Remove a user from the store                              |

### Pages (`src/app/`)

| Route                | Type            | Description                                                                          |
| -------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `/`                  | Server          | Redirects to `/dashboard` if authenticated, else `/login`                            |
| `/login`             | Client          | Email/password form + Google Sign-In button (rendered via GSI script)                |
| `/dashboard`         | Server          | Sales summary stats + recent sales table                                             |
| `/content`           | Server          | Lists all content items with edit/delete actions                                     |
| `/content/new`       | Client          | Content creation form — `markdown` (textarea) or `external_ref` (URI + identifier)   |
| `/content/[id]/edit` | Server + Client | Load existing item (server); edit form with PATCH submit; type-aware fields (client) |
| `/users`             | Server + Client | Lists team members (server); invite form + remove buttons (client)                   |

### Shared Components (`src/components/`)

- `NavBar.tsx` — Async Server Component; reads session for multi-store list; renders `StoreSelector` when merchant has >1 store
- `StoreSelector.tsx` — Client component `<select>` that POSTs to `/api/stores/select` and refreshes the page
- `LogoutButton.tsx` — Client component; calls `POST /api/auth/logout`, then `router.push('/login')`

---

## What Remains To Do

### Phase 1 — Get it running (devcontainer)

- [ ] Reopen in devcontainer (triggers `npm install` + `tsc --noEmit`)
- [ ] Copy `.env.example` → `.env.local` and fill in `SESSION_SECRET`
- [ ] Run `npm run dev` and verify login flow end-to-end

### Phase 2 — Polish & correctness

- [x] **Type-check pass** — 14 errors fixed; root cause documented in `SDK-FEEDBACK.md`
- [x] **Content list page** — `/content` listing all content items for the store (`client.seller.content.list(storeId)`) with delete action; `GET /api/content` and `DELETE /api/content/[contentId]` routes added
- [x] **Content edit page** — `/content/[id]/edit` with `GET /api/content/[contentId]` and `PATCH /api/content/[contentId]`; pre-fills form; handles 401 redirect
- [x] **External-ref content type** — both New and Edit forms show a `content_type` selector; choosing `external_ref` swaps the markdown textarea for `content_uri` + `external_identifier` fields; `POST /api/content` and `PATCH /api/content/[contentId]` forward the new fields; `ContentTable` renders external items as links
- [x] **Store selector** — session stores list persisted at login; `StoreSelector` client component in NavBar; `POST /api/stores/select` validates against known stores
- [x] **Error boundaries** — `src/app/(admin)/error.tsx` wraps all admin routes

### Phase 3 — Auth hardening

- [x] **Token expiry handling** — all client components redirect to `/login` on 401 response (`ContentTable`, `EditContentForm`, `InviteForm`, `UserList`)
- [x] **CSRF protection** — upgraded session cookie `SameSite` from `'lax'` to `'strict'`
- [x] **Google Client ID validation** — `extractJwtAudience()` verifies `aud` claim against `NEXT_PUBLIC_GOOGLE_CLIENT_ID` before delegating to SDK (defence-in-depth)

### Phase 4 — Content management UX

- [x] **Markdown preview** — split-pane editor (`MarkdownEditor` component) with live preview on the new/edit content pages; `external_ref` items skip the preview and show URI fields instead; output sanitised via `rehype-sanitize`
- [x] **Pagination** — client-side pagination (`Pagination` component, `PAGE_SIZE=10`) on the content list (`ContentTable`) and the sales table (`SalesTable`); SDK limitation (no server-side paging) documented in `SDK-FEEDBACK.md`
- [x] **Search** — client-side title filter on the content list (`ContentTable`); `POST /api/content/search` route proxies SDK metadata search; SDK full-text limitation documented in `SDK-FEEDBACK.md`

### Phase 5 — Production readiness

- [x] **SDK upgrade to 0.4.0** — `loginWithEmailAndListStores`, paginated lists, discriminated `Content` union, `@ledewire/node/testing` mock client, type declarations fully bundled
- [x] **SDK upgrade to 0.5.0** — `MerchantLoginResult.tokens` now `StoredTokens` (camelCase); `ForbiddenError` for wrong-role logins; `MerchantInviteRequest.is_author` optional; `ContentListItem` includes `content_uri`; `ManageableStore` field names unified; `client.config.getPublic()` unauthenticated endpoint. Login page refactored to server component fetching `google_client_id` from API. See `SDK-FEEDBACK.md` for full details.
- [ ] **Deployment** — Vercel or Docker; add `Dockerfile` if self-hosting
- [ ] **Logging** — structured server-side logging for auth events and API errors

---

## Upgrade Notes

A step-by-step record of what changed during SDK upgrades and why — written for anyone
upgrading from a previous version of `@ledewire/node` in a Next.js 15 App Router project.

---

### Upgrading `@ledewire/node` — general checklist

Run these steps for every SDK version bump before doing anything else:

```bash
# 1. Install the new version
npm install @ledewire/node@latest

# 2. Clear the Next.js build cache — stale webpack chunks cause silent CSS/JS
#    failures that look like compile errors but aren't.
rm -rf .next

# 3. Type-check immediately — SDK type changes surface here before runtime
npm run typecheck

# 4. Run the full test suite
npm test

# 5. Kill any lingering dev-server processes, then start fresh
kill $(lsof -ti :3000) 2>/dev/null
npm run dev
```

---

### 0.4.0 → 0.5.0 migration guide

#### 1. Token mapping — `MerchantLoginResult.tokens` is now `StoredTokens`

**What changed:** `loginWithEmailAndListStores()` and `loginWithGoogleAndListStores()` now
return `tokens` typed as `StoredTokens` (camelCase fields, `expiresAt` as a Unix ms
timestamp) rather than the raw API shape (`access_token`, `expires_at` ISO string).

**Before (0.4.0):**
```ts
import { parseExpiresAt } from '@ledewire/node'

const { tokens, stores } = await client.merchant.auth.loginWithEmailAndListStores(...)
session.accessToken = tokens.access_token
session.refreshToken = tokens.refresh_token
session.expiresAt = parseExpiresAt(tokens.expires_at)
```

**After (0.5.0):**
```ts
// parseExpiresAt import removed — no longer needed
const { tokens, stores } = await client.merchant.auth.loginWithEmailAndListStores(...)
session.accessToken = tokens.accessToken
session.refreshToken = tokens.refreshToken
session.expiresAt = tokens.expiresAt
```

Files changed: [`src/app/api/auth/login/route.ts`](src/app/api/auth/login/route.ts),
[`src/app/api/auth/google/route.ts`](src/app/api/auth/google/route.ts)

---

#### 2. `ForbiddenError` for wrong-account-role logins

**What changed:** When a valid buyer account attempts merchant login, the SDK now throws
`ForbiddenError` (HTTP 403) with the message
`"This account does not have merchant access. Use a merchant or owner account."`.
Previously this came back as a generic `LedewireError` with status 403, so callers couldn't
distinguish it from other API errors.

**`ForbiddenError` is a subclass of `LedewireError` — catch it first.**

**Before (0.4.0):**
```ts
} catch (err) {
  if (err instanceof AuthError)    return NextResponse.json({ error: '...' }, { status: 401 })
  if (err instanceof LedewireError) return NextResponse.json({ error: err.message }, { status: err.statusCode })
  throw err
}
```

**After (0.5.0):**
```ts
import { ForbiddenError, AuthError, LedewireError } from '@ledewire/node'

} catch (err) {
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
  if (err instanceof AuthError)      return NextResponse.json({ error: '...' }, { status: 401 })
  if (err instanceof LedewireError)  return NextResponse.json({ error: err.message }, { status: err.statusCode })
  throw err
}
```

Files changed: [`src/app/api/auth/login/route.ts`](src/app/api/auth/login/route.ts),
[`src/app/api/auth/google/route.ts`](src/app/api/auth/google/route.ts)

---

#### 3. `MerchantInviteRequest.is_author` is now optional

**What changed:** `is_author` was previously required (`boolean`) despite the server
defaulting it to `true`. It is now `boolean | undefined` — the explicit `is_author: true`
at every call site can be removed.

**Before (0.4.0):**
```ts
await client.merchant.users.invite(storeId, {
  email,
  is_author: true,   // required even though it was always true
})
```

**After (0.5.0):**
```ts
await client.merchant.users.invite(storeId, {
  email,
  // is_author omitted — defaults to true on the server
})
```

File changed: [`src/app/api/users/route.ts`](src/app/api/users/route.ts)

---

#### 4. `ContentListItem` now includes `content_uri`

**What changed:** `SellerContentNamespace.list()` and `.search()` now return
`content_uri: string | null` on each item. Previously `content_uri` was absent from list
results, requiring a separate `content.get()` call per `external_ref` item (N+1) to render a
"View ↗" link.

**Impact on test factories:** `src/test/factories.ts` `makeContent()` returned an object
without `content_uri`, which was assignable to the old `ContentListItem` shape
(`string | undefined`). The new shape requires `string | null`. Add an explicit default:

```ts
// Before
export function makeContent(overrides = {}) {
  return { ..., teaser: '' as string, ...overrides }
}

// After — content_uri must be explicitly null, not undefined
export function makeContent(overrides = {}) {
  return { ..., teaser: '' as string, content_uri: null as string | null, ...overrides }
}
```

File changed: [`src/test/factories.ts`](src/test/factories.ts)

---

#### 5. `ManageableStore` field names unified with `MerchantLoginStore`

**What changed:** `ManageableStore` (returned by `listStores()`) previously used `store_id`
and `store_name`. It now uses `id` and `name`, matching `MerchantLoginStore`. No code change
was needed in this project because we used `MerchantLoginStore` (from the login helper) rather
than calling `listStores()` directly, but any code that called `store.store_id` or
`store.store_name` will need updating.

---

#### 6. `client.config.getPublic()` — unauthenticated platform config

**What changed:** A new `ConfigNamespace` is available on every client instance. It exposes
`getPublic()`, which returns `{ google_client_id: string }` with no auth required. This
breaks the previous circular dependency where `google_client_id` was needed before login but
only available after.

**Migration pattern — server component fetches config, passes to client form:**

```ts
// page.tsx — server component
import { createClient } from '@ledewire/node'
import { config } from '@/lib/config'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  let googleClientId: string | null = null
  try {
    const client = createClient({ baseUrl: config.ledewireBaseUrl })
    const publicConfig = await client.config.getPublic()
    googleClientId = publicConfig.google_client_id ?? null
  } catch {
    // Graceful degradation — Google Sign-In hidden if API unreachable
  }
  return <LoginForm googleClientId={googleClientId} />
}
```

```ts
// LoginForm.tsx — 'use client', accepts googleClientId as a prop
interface Props { googleClientId: string | null }
export default function LoginForm({ googleClientId }: Props) { ... }
```

**`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is no longer needed** and can be removed from `.env.local`.

Files changed: [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx) (converted
to server component), new [`src/app/(auth)/login/LoginForm.tsx`](src/app/(auth)/login/LoginForm.tsx)

---

### Next.js 15.2 — `TokenStorage.clearTokens` in Server Components

**This is a Next.js breaking change, not an SDK change**, but it surfaces during an SDK
upgrade if the SDK calls `clearTokens` while rendering a Server Component (e.g. when a token
expires mid-render).

**Symptom:**
```
Error: Cookies can only be modified in a Server Action or Route Handler.
  at Object.clearTokens (src/lib/ledewire.ts:35:21)
```

**Root cause:** Next.js 15.2 now enforces that `session.destroy()` (and `session.save()`)
can only be called from a Route Handler or Server Action — not from within a Server Component
render, even if called indirectly through the SDK's `TokenStorage` adapter.

**Fix** — wrap `session.destroy()` in try/catch in `createMerchantClient()`:

```ts
// src/lib/ledewire.ts
async clearTokens(): Promise<void> {
  try {
    await session.destroy()
  } catch {
    // Fallback for Server Component context (Next.js 15.2+).
    // Null out the session fields so requireAuth() redirects on the next request.
    session.accessToken = undefined
    session.refreshToken = undefined
    session.expiresAt = undefined
    session.storeId = undefined
    session.stores = undefined
  }
},
```

`requireAuth()` checks `session.accessToken` on every protected page request — once the
fields are nulled the user is redirected to `/login` on the next navigation.

File changed: [`src/lib/ledewire.ts`](src/lib/ledewire.ts)

---

### Why no API key in the backend?

`@ledewire/node` supports two auth modes. The merchant email/password (or Google) flow issues
a JWT pair that is sufficient for content creation, user management, and sales reporting.
Storing a long-lived API key/secret in the backend would be an unnecessary credential exposure.
The token is stored only in the encrypted, httpOnly `iron-session` cookie — it is never
accessible to client-side JavaScript.

### Token refresh

The `TokenStorage` adapter in [`src/lib/ledewire.ts`](src/lib/ledewire.ts) is called by the
SDK automatically when the access token nears expiry. The refreshed tokens are written back
to the session cookie transparently — no route handler needs to handle refresh explicitly.

### Server Components vs. Client Components

Data-fetching pages (`/dashboard`, `/users`) are **Server Components** — they call the SDK
directly, and no LedeWire tokens are serialised into the HTML or passed to the browser.
Only mutation-heavy UI (login form, invite form, remove buttons) are **Client Components**
that call the Next.js API routes.

## Appendix

### Key Resources

- [Ledewire SDK (Github)](https://github.com/ledewire/ledewire-js-sdk)
- [Ledewire SDK (NPMP)](https://www.npmjs.com/package/@ledewire/node)
