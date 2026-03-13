# LedeWire Demo Producer Site — Implementation Plan

A Next.js 15 merchant admin app backed by the `@ledewire/node` SDK.
Merchants log in with email/password or Google, then manage content and invite authors.
No API key or secret is stored — all operations run on the merchant auth token.

---

## Architecture Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components for data fetching, Route Handlers for API |
| Auth strategy | `client.merchant.auth.loginWithEmail()` / `loginWithGoogle()` | No API key/secret needed; merchant token sufficient for all operations |
| Session storage | `iron-session` encrypted httpOnly cookie | Tokens never exposed to client JS; survives page reload |
| Token refresh | SDK `TokenStorage` adapter writes back to the cookie | Transparent — no manual refresh logic needed |
| Styling | Tailwind CSS + `@tailwindcss/forms` | Utility-first; no component library dependency |
| Dev environment | VS Code devcontainer (Node 20, TypeScript, ESLint, Prettier) | Reproducible in Codespaces or locally |

---

## Current State (what has been scaffolded)

### Config & Tooling
- [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json) — Node 20 container, port 3000 forwarded, VS Code extensions pre-installed
- [`package.json`](package.json) — Next.js 15, `@ledewire/node ^0.2.1`, `iron-session`, Tailwind
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
| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Email/password login → sets session cookie |
| `/api/auth/google` | POST | Google `id_token` login → sets session cookie |
| `/api/auth/logout` | POST | Destroys session cookie |
| `/api/content` | GET | List all content items for the active store |
| `/api/content` | POST | Create a new content item (seller API via merchant token) |
| `/api/content/[contentId]` | GET | Fetch a single content item |
| `/api/content/[contentId]` | PATCH | Update a content item (sparse fields) |
| `/api/content/[contentId]` | DELETE | Delete a content item |
| `/api/stores/select` | POST | Switch active store in session |
| `/api/users` | POST | Invite a user to the store |
| `/api/users/[userId]` | DELETE | Remove a user from the store |

### Pages (`src/app/`)
| Route | Type | Description |
|---|---|---|
| `/` | Server | Redirects to `/dashboard` if authenticated, else `/login` |
| `/login` | Client | Email/password form + Google Sign-In button (rendered via GSI script) |
| `/dashboard` | Server | Sales summary stats + recent sales table |
| `/content` | Server | Lists all content items with edit/delete actions |
| `/content/new` | Client | Content creation form — `markdown` (textarea) or `external_ref` (URI + identifier) |
| `/content/[id]/edit` | Server + Client | Load existing item (server); edit form with PATCH submit; type-aware fields (client) |
| `/users` | Server + Client | Lists team members (server); invite form + remove buttons (client) |

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
- [ ] **Environment config** — document staging vs. production `LEDEWIRE_BASE_URL` switching
- [ ] **Deployment** — Vercel or Docker; add `Dockerfile` if self-hosting
- [ ] **Logging** — structured server-side logging for auth events and API errors

---

## Key Design Notes

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
