# Testing — Coverage & Gaps

Run the test suite with:

```bash
npm test            # single run
npm run test:watch  # watch mode
npm run test:coverage
```

---

## Existing test files

| File                                                                                                                           | What's covered                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [src/components/MarkdownEditor.test.tsx](src/components/MarkdownEditor.test.tsx)                                               | Render, pre-fill, placeholder, live preview, hidden input sync                                                |
| [src/components/Pagination.test.tsx](src/components/Pagination.test.tsx)                                                       | Single-page (no render), page info, button disable states, callbacks                                          |
| [src/app/(admin)/dashboard/SalesTable.test.tsx](<src/app/(admin)/dashboard/SalesTable.test.tsx>)                               | Empty state, pagination, currency formatting                                                                  |
| [src/app/(admin)/content/ContentTable.test.tsx](<src/app/(admin)/content/ContentTable.test.tsx>)                               | Render, badges, links, delete + confirmation, optimistic rollback, errors, loading, pagination                |
| [src/app/(admin)/content/[id]/edit/EditContentForm.test.tsx](<src/app/(admin)/content/%5Bid%5D/edit/EditContentForm.test.tsx>) | Pre-fill, base64 decode, PATCH, redirect on success/401, price validation, loading state, content-type toggle |
| [src/app/api/content/route.test.ts](src/app/api/content/route.test.ts)                                                         | GET list/empty/401, POST create/validate/external_ref                                                         |
| [src/app/api/content/[contentId]/route.test.ts](src/app/api/content/%5BcontentId%5D/route.test.ts)                             | GET/PATCH/DELETE with auth/404 cases, partial updates                                                         |
| [src/app/api/content/search/route.test.ts](src/app/api/content/search/route.test.ts)                                           | Query with metadata, validation, error forwarding                                                             |
| [src/app/api/users/[userId]/route.test.ts](src/app/api/users/%5BuserId%5D/route.test.ts)                                       | PATCH fee (set/clear/validate), DELETE, auth/error handling                                                   |
| [src/app/api/stores/select/route.test.ts](src/app/api/stores/select/route.test.ts)                                             | Valid switch, validation, auth, JSON parsing                                                                  |
| [src/app/api/auth/login/route.test.ts](src/app/api/auth/login/route.test.ts)                                                   | Validation, token storage, single/multi-store auto-select, ForbiddenError/AuthError/SDK errors                |
| [src/app/api/auth/google/route.test.ts](src/app/api/auth/google/route.test.ts)                                                 | JWT audience validation, absent clientId, token storage, store selection, all error paths                     |
| [src/app/api/auth/logout/route.test.ts](src/app/api/auth/logout/route.test.ts)                                                 | session.destroy() called, returns ok                                                                          |
| [src/app/api/users/route.test.ts](src/app/api/users/route.test.ts)                                                             | Validation, invite with/without fee, null fee, auth/SDK error paths                                           |
| [src/app/(admin)/users/UserList.test.tsx](<src/app/(admin)/users/UserList.test.tsx>)                                           | Render, pending badge, delete (confirm/cancel/error/401), fee editor (edit/save/default/error)                |
| [src/app/(admin)/users/InviteForm.test.tsx](<src/app/(admin)/users/InviteForm.test.tsx>)                                       | Fee validation, successful invite (form reset, refresh), API error, 401 redirect, loading state               |
| [src/app/(auth)/login/LoginForm.test.tsx](<src/app/(auth)/login/LoginForm.test.tsx>)                                           | Email/password submit, redirects, error display, loading state, Google credential callback                    |
| [src/app/(auth)/select-store/StorePicker.test.tsx](<src/app/(auth)/select-store/StorePicker.test.tsx>)                         | Store button click, loading state, error display, redirect, network error, empty state                        |
| [src/app/(admin)/content/new/page.test.tsx](<src/app/(admin)/content/new/page.test.tsx>)                                       | Markdown + external_ref submission, price validation, error/401 handling, content-type toggle                 |
| [src/components/StoreSelector.test.tsx](src/components/StoreSelector.test.tsx)                                                 | Option rendering, default selection, POST + navigate on success, disabled state, error display, network error |

**Overall coverage (as of last run):** ~78% lines · ~88% branch · ~77% function

---

## Coverage gaps

### � Low priority (only remaining)

| File                  | Notes                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| `NavBar.tsx`          | Mostly static rendering; not much to assert                                      |
| `LogoutButton.tsx`    | Calls `/api/auth/logout` and redirects — one happy-path test would be sufficient |
| `StoreSelector.tsx`   | ✅ Now covered by `StoreSelector.test.tsx`                                       |
| `SalesTable.test.tsx` | Missing previous-page navigation; minor                                          |
| `Pagination.test.tsx` | Rapid click / keyboard nav; very low value                                       |
