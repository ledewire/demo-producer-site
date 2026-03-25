# Code Review — Initial Findings

> Reviewed: March 2026
> Reviewer: GitHub Copilot
> Scope: Full codebase audit — performance, correctness, security, code quality

---

## Priority Summary

| Priority             | Status   | Issue                                                                                    | Files Affected                                                           |
| -------------------- | -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **P0 — Bug**         | ✅ Fixed | `requireAuth()` used in Route Handlers — produces redirect responses instead of 401 JSON | All API routes except `auth/`                                            |
| **P1 — Performance** | ✅ Fixed | `getSession()` called 3× per page render (requireAuth, createMerchantClient, NavBar)     | `lib/auth.ts`, `lib/ledewire.ts`, `components/NavBar.tsx`                |
| **P1 — Performance** | 🔴 Open  | Unbounded `content.list()` and `sales.list()` with client-side pagination                | `api/content/route.ts`, `dashboard/page.tsx`, `content/ContentTable.tsx` |
| **P2 — Correctness** | ✅ Fixed | `ForbiddenError` not caught in any Route Handler except login                            | All API routes except `api/auth/login/route.ts`                          |
| **P2 — Quality**     | ✅ Fixed | Deprecated `escape`/`unescape` Unicode base64 hack                                       | `content/[id]/edit/EditContentForm.tsx`                                  |
| **P3 — UX**          | ✅ Fixed | `window.confirm()` used for destructive action confirmations                             | `ContentTable.tsx`, `UserList.tsx`                                       |
| **P3 — Resilience**  | ✅ Fixed | Missing `catch` block in `UserList.handleRemove` — network errors propagate unhandled    | `users/UserList.tsx`                                                     |

---

## Detailed Findings

### P0 — `requireAuth()` Must Not Be Called from Route Handlers

**Status: ✅ Fixed** — All 5 route handlers now call `getSession()` directly and return a JSON 401.

**Files:** `src/app/api/users/route.ts`, `src/app/api/users/[userId]/route.ts`, `src/app/api/content/route.ts`, `src/app/api/content/[contentId]/route.ts`, `src/app/api/content/search/route.ts`

**Problem:** `requireAuth()` calls `redirect()` on failure (a Next.js server navigation throw). When called from a Route Handler, this produces a `307` HTML redirect response instead of a JSON `401`. Client components check `res.status === 401` and then call `await res.json()` — which throws against an HTML document. The 401 guard never fires.

This is also explicitly documented as forbidden in `.github/copilot-instructions.md`:

> _"Route Handlers must check the session directly and return `{ status: 401 }` — never call `requireAuth()`"_

---

### P1 — Triple `getSession()` Calls Per Page Render

**Status: ✅ Fixed** — `getSession` is now wrapped with `React.cache` in `lib/session.ts`.

**Files:** `src/lib/auth.ts` (`requireAuth`), `src/lib/ledewire.ts` (`createMerchantClient`), `src/components/NavBar.tsx`

**Problem:** A typical admin page `requireAuth()` + `createMerchantClient()` + `NavBar` render triggers three separate iron-session cookie decryptions (AES-GCM) per request. These are sequential awaits, not parallelisable.

---

### P1 — Unbounded List Fetches With Client-Side Pagination

**Status: 🔴 Open**

**Files:** `src/app/(admin)/content/ContentTable.tsx`, `src/app/(admin)/dashboard/page.tsx`, `src/app/api/content/route.ts`

**Problem:**

- `ContentTable` fetches the full content catalog (`seller.content.list()` with no limit), ships the entire payload to the client, then paginates and filters locally with `PAGE_SIZE = 10`. At scale this wastes bandwidth and server memory.
- `dashboard/page.tsx` calls `merchant.sales.list(storeId)` with no pagination parameters.
- A `GET /api/content` route and a `POST /api/content/search` route exist but are unused by filtering — client-side string matching is used instead.

**Fix:** Pass `limit` and `page` (or `cursor`) to list calls. Move search to the server — the search route already exists. Use server-driven pagination; pass `totalPages` from the API response rather than deriving it by counting all loaded items.

---

### P2 — `ForbiddenError` Not Caught Outside the Login Route

**Status: ✅ Fixed** — All route handlers now check `ForbiddenError` before `LedewireError`.

**Files:** All Route Handlers except `src/app/api/auth/login/route.ts`

**Problem:** `ForbiddenError` extends `LedewireError`. Without an explicit `ForbiddenError` catch before `LedewireError`, it falls through to the generic branch — correct only if its `statusCode` happens to be 403. This is implicit behaviour dependent on SDK implementation details.

---

### P2 — Deprecated Unicode/Base64 Encoding

**Status: ✅ Fixed** — Replaced with `TextEncoder`/`TextDecoder` in `EditContentForm.tsx`.

**File:** `src/app/(admin)/content/[id]/edit/EditContentForm.tsx`

**Problem:** The content body was encoded/decoded using `escape()`/`unescape()` — deprecated since ES3, handling non-ASCII incorrectly, and not available in all environments.

---

### P3 — `window.confirm()` for Destructive Actions

**Status: ✅ Fixed** — Both components now use an inline two-step "Delete? Yes / No" confirmation pattern.

**Files:** `src/app/(admin)/content/ContentTable.tsx`, `src/app/(admin)/users/UserList.tsx`

**Problem:** `confirm()` is a blocking, inaccessible dialog. It is suppressed in some browser contexts (cross-origin iframes), styled inconsistently across platforms, and poorly supported by screen readers.

---

### P3 — Missing `catch` in `UserList.handleRemove`

**Status: ✅ Fixed** — Added `catch` block that sets a user-facing error message on network failure.

**File:** `src/app/(admin)/users/UserList.tsx`

**Problem:** The `handleRemove` function used `try { ... } finally { ... }` with no `catch`. Network errors propagated uncaught to the nearest React error boundary rather than displaying an inline error message. `ContentTable.handleDelete` correctly had a `catch` — this was an inconsistency.

---

## Detailed Findings

### P0 — `requireAuth()` Must Not Be Called from Route Handlers

**Files:** `src/app/api/users/route.ts`, `src/app/api/users/[userId]/route.ts`, `src/app/api/content/route.ts`, `src/app/api/content/[contentId]/route.ts`, `src/app/api/content/search/route.ts`

**Problem:** `requireAuth()` calls `redirect()` on failure (a Next.js server navigation throw). When called from a Route Handler, this produces a `307` HTML redirect response instead of a JSON `401`. Client components check `res.status === 401` and then call `await res.json()` — which throws against an HTML document. The 401 guard never fires.

This is also explicitly documented as forbidden in `.github/copilot-instructions.md`:

> _"Route Handlers must check the session directly and return `{ status: 401 }` — never call `requireAuth()`"_

**Fix:** Replace `requireAuth()` in all Route Handlers with a direct session check:

```ts
const session = await getSession()
if (!session.accessToken || !session.storeId) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
}
const { accessToken, storeId } = session
```

---

### P1 — Triple `getSession()` Calls Per Page Render

**Files:** `src/lib/auth.ts` (`requireAuth`), `src/lib/ledewire.ts` (`createMerchantClient`), `src/components/NavBar.tsx`

**Problem:** A typical admin page `requireAuth()` + `createMerchantClient()` + `NavBar` render triggers three separate iron-session cookie decryptions (AES-GCM) per request. These are sequential awaits, not parallelisable.

**Fix:** Next.js 15's `React.cache` can deduplicate `getSession()` calls within a single render pass. Wrap the call:

```ts
// lib/session.ts
import { cache } from 'react'

export const getSession = cache(async () => {
  return getIronSession<SessionData>(await cookies(), buildOptions())
})
```

This is a one-line fix that eliminates redundant decryptions at zero cost.

---

### P1 — Unbounded List Fetches With Client-Side Pagination

**Files:** `src/app/(admin)/content/ContentTable.tsx`, `src/app/(admin)/dashboard/page.tsx`, `src/app/api/content/route.ts`

**Problem:**

- `ContentTable` fetches the full content catalog (`seller.content.list()` with no limit), ships the entire payload to the client, then paginates and filters locally with `PAGE_SIZE = 10`. At scale this wastes bandwidth and server memory.
- `dashboard/page.tsx` calls `merchant.sales.list(storeId)` with no pagination parameters.
- A `GET /api/content` route and a `POST /api/content/search` route exist but are unused by filtering — client-side string matching is used instead.

**Fix:** Pass `limit` and `page` (or `cursor`) to list calls. Move search to the server — the search route already exists. Use server-driven pagination; pass `totalPages` from the API response rather than deriving it by counting all loaded items.

---

### P2 — `ForbiddenError` Not Caught Outside the Login Route

**Files:** All Route Handlers except `src/app/api/auth/login/route.ts`

**Problem:** `ForbiddenError` extends `LedewireError`. Without an explicit `ForbiddenError` catch before `LedewireError`, it falls through to the generic branch — correct only if its `statusCode` happens to be 403. This is implicit behaviour dependent on SDK implementation details.

Per the project conventions:

> _"Check `ForbiddenError` before `LedewireError` (it is a subclass)"_

**Fix:** Add to every Route Handler's catch chain:

```ts
if (err instanceof ForbiddenError) {
  return NextResponse.json({ error: err.message }, { status: 403 })
}
```

---

### P2 — Deprecated Unicode/Base64 Encoding

**File:** `src/app/(admin)/content/[id]/edit/EditContentForm.tsx`

**Problem:** The content body is encoded/decoded using:

```ts
// Encode
btoa(unescape(encodeURIComponent(value)))

// Decode
decodeURIComponent(escape(atob(encoded)))
```

`escape()` and `unescape()` are deprecated since ES3, handle non-ASCII incorrectly, and are not available in all environments. This is a legacy workaround predating `TextEncoder`.

**Fix:**

```ts
// Encode — UTF-8 safe
const bytes = new TextEncoder().encode(value)
const binary = Array.from(bytes)
  .map((b) => String.fromCharCode(b))
  .join('')
const encoded = btoa(binary)

// Or avoid base64 entirely if the API accepts plain UTF-8 strings
```

---

### P3 — `window.confirm()` for Destructive Actions

**Files:** `src/app/(admin)/content/ContentTable.tsx`, `src/app/(admin)/users/UserList.tsx`

**Problem:** `confirm()` is a blocking, inaccessible dialog. It is suppressed in some browser contexts (cross-origin iframes), styled inconsistently across platforms, and poorly supported by screen readers. Using it for irreversible delete confirmations is not production-appropriate UX.

**Fix:** Replace with an inline confirmation pattern (e.g., a two-step button: first click shows "Are you sure? [Confirm] [Cancel]", second click executes). No modal library required.

---

### P3 — Missing `catch` in `UserList.handleRemove`

**File:** `src/app/(admin)/users/UserList.tsx`

**Problem:** The `handleRemove` function uses `try { ... } finally { ... }` with no `catch`. If `fetch()` itself throws (network failure, timeout, DNS error), the exception propagates uncaught to the nearest React error boundary — which may or may not exist, and will at minimum crash the component subtree without showing a user-facing message.

`ContentTable.handleDelete` correctly includes a `catch` block. This is an inconsistency.

**Fix:** Add a `catch` block mirroring `ContentTable`:

```ts
} catch {
  setError('Network error — please try again')
}
```
