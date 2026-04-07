import type { ContentResponse, MerchantUser } from '@ledewire/node'
import type { MerchantPricingRule, MerchantDomainVerification } from '@/lib/content'

/**
 * Test data factories.
 */

// Superset of ContentResponse / ContentListItem / ContentTable.ContentItem.
// Inferred return type keeps all test mock assignments structurally compatible.
export type ContentResponseShape = ReturnType<typeof makeContent>

type Overrides = Partial<{
  id: string
  store_id: string
  title: string
  content_type: 'markdown' | 'external_ref'
  content_body: string
  teaser: string
  price_cents: number
  visibility: 'public' | 'unlisted' | 'private'
  created_at: string
  updated_at: string
  content_uri: NonNullable<ContentResponse['content_uri']>
  external_identifier: NonNullable<ContentResponse['external_identifier']>
}>

export function makeContent(overrides: Overrides = {}) {
  return {
    id: 'content-001',
    store_id: 'store-abc',
    title: 'Test Article',
    content_type: 'markdown' as 'markdown' | 'external_ref',
    content_body: btoa('# Hello'),
    teaser: '' as string,
    price_cents: 299,
    visibility: 'public' as 'public' | 'unlisted' | 'private',
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
    content_uri: null as string | null,
    ...overrides,
  }
}

export function makeExternalContent(overrides: Overrides = {}) {
  return makeContent({
    content_type: 'external_ref',
    content_uri: 'https://vimeo.com/987654321',
    external_identifier: 'vimeo:987654321',
    ...overrides,
  })
}

export function makePagination(total = 2) {
  return {
    total,
    per_page: 25,
    current_page: 1,
    total_pages: Math.ceil(total / 25),
  }
}

export function makeMerchantUser(overrides: Partial<MerchantUser> = {}): MerchantUser {
  return {
    id: 'store-user-001',
    user_id: 'user-001',
    store_id: 'store-abc',
    role: null,
    is_author: true,
    author_fee_bps: null,
    invited_at: '2026-01-01T00:00:00.000Z',
    accepted_at: '2026-01-02T00:00:00.000Z',
    email: 'author@example.com',
    ...overrides,
  }
}

export function makePricingRule(overrides: Partial<MerchantPricingRule> = {}): MerchantPricingRule {
  return {
    id: 'rule-001',
    store_id: 'store-abc',
    url_pattern: 'https://example.com/articles/*',
    price_cents: 150,
    active: true,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeDomainVerification(
  overrides: Partial<MerchantDomainVerification> = {},
): MerchantDomainVerification {
  return {
    id: 'domain-001',
    store_id: 'store-abc',
    domain: 'example.com',
    status: 'pending',
    txt_record_name: '_ledewire-verify.example.com',
    txt_record_value: 'ledewire-verify=abc123',
    verified_at: null,
    checked_at: null,
    created_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}
