# LedeWire Producer Site

A Next.js 15 merchant admin application for the [LedeWire](https://ledewire.com) content platform. Merchants log in with email/password or Google, then manage their content catalogue and invite authors to their store.

> **Status:** Demo / reference implementation. Intended to evolve into the centrally-hosted LedeWire customer backend UI.

---

## Features

- **Email + Google authentication** via the `@ledewire/node` SDK — no API key required; the merchant token handles all operations
- **Content management** — create, edit, and delete content items; supports both `markdown` and `external_ref` types with a live split-pane Markdown preview
- **Sales dashboard** — aggregated revenue/sales stats with a paginated sales table
- **Team management** — invite authors to your store and remove existing members
- **Multi-store support** — switch active store from the nav bar when a merchant manages more than one
- **Session security** — encrypted `httpOnly` iron-session cookie; `SameSite=Strict` for CSRF protection; Google JWT audience validated before delegating to SDK

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Auth / session | `@ledewire/node` SDK + `iron-session` |
| Styling | Tailwind CSS + `@tailwindcss/forms` |
| Markdown | `react-markdown` + `rehype-sanitize` |
| Testing | Vitest + React Testing Library |
| Dev environment | VS Code devcontainer (Node 20) |

---

## Getting Started

### Option A — VS Code Dev Container (recommended)

1. Open the repository in VS Code and choose **Reopen in Container** when prompted (or run `Dev Containers: Reopen in Container` from the command palette).
2. `npm install` and `tsc --noEmit` run automatically on container creation.
3. Copy `.env.example` to `.env.local` and fill in the required values (see [Environment Variables](#environment-variables) below).
4. Start the dev server:

   ```bash
   npm run dev
   ```

5. The container auto-forwards port 3000 — the browser should open automatically.

### Option B — Local

Prerequisites: Node 20+.

```bash
npm install
cp .env.example .env.local
# edit .env.local
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | **Yes** | Iron-session encryption key — minimum 32 characters. Generate with `openssl rand -hex 32`. |
| `LEDEWIRE_BASE_URL` | No | LedeWire API base URL. Defaults to `https://api.ledewire.com`. Override to point at a staging instance. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | Google OAuth client ID. When set, a **Sign in with Google** button is shown on the login page. Create one at [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials. |

---

## Available Scripts

```bash
npm run dev            # Start Next.js dev server (hot reload)
npm run build          # Production build
npm run start          # Serve production build
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint via next lint
npm run test           # Vitest (single run)
npm run test:watch     # Vitest (watch mode)
npm run test:coverage  # Vitest with coverage report
```

---

## Project Structure

```
src/
├── app/
│   ├── (admin)/           # Authenticated admin routes (layout + NavBar)
│   │   ├── content/       # Content list, new, and edit pages
│   │   ├── dashboard/     # Sales summary
│   │   └── users/         # Team management
│   ├── (auth)/login/      # Login page (email + Google)
│   └── api/               # Route Handlers
│       ├── auth/          # login, logout, google
│       ├── content/       # CRUD + search
│       ├── stores/select  # Active-store switcher
│       └── users/         # Invite + remove
├── components/            # Shared UI (NavBar, Pagination, MarkdownEditor…)
├── lib/                   # config, session, ledewire client, auth guard
├── middleware.ts          # Cookie-presence guard for admin paths
└── test/                  # Vitest setup and test factories
```

---

## Architecture Notes

- **No API key in session** — only the merchant access token is stored. All SDK calls use `createMerchantClient()` in `src/lib/ledewire.ts`, which wires a `TokenStorage` adapter to the iron-session cookie so tokens are refreshed transparently.
- **`requireAuth()`** in `src/lib/auth.ts` is for **Server Components only**. Route Handlers check the session directly and return `401` rather than calling `redirect()`.
- **Client-side pagination/search** — the LedeWire SDK (v0.2.x) does not expose server-side paging or full-text search parameters. Both are applied client-side; see `SDK-FEEDBACK.md` for details.

---

## Contributing

This is currently a demo / reference implementation. Issues and pull requests are welcome, particularly around the items listed in `PLAN.md` under *Phase 5 — Production readiness*.

---

## License

[MIT](LICENSE)
