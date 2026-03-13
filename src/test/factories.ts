/**
 * Test data factories.
 *
 * Because @ledewire/core types resolve to `any` in strict TS (SDK packaging
 * issue — see SDK-FEEDBACK.md #1), we define our own minimal interfaces here
 * so tests are self-documenting and type-safe independent of the SDK.
 */

export interface ContentResponseShape {
  id: string
  store_id: string
  title: string
  content_type: string
  content_body: string
  content_uri?: string
  external_identifier?: string
  price_cents: number
  visibility: string
  created_at: string
  updated_at: string
}

export function makeContent(overrides: Partial<ContentResponseShape> = {}): ContentResponseShape {
  return {
    id: 'content-001',
    store_id: 'store-abc',
    title: 'Test Article',
    content_type: 'markdown',
    content_body: btoa('# Hello'),
    price_cents: 299,
    visibility: 'public',
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
    ...overrides,
  }
}

export function makeExternalContent(overrides: Partial<ContentResponseShape> = {}): ContentResponseShape {
  return makeContent({
    content_type: 'external_ref',
    content_body: '',
    content_uri: 'https://vimeo.com/987654321',
    external_identifier: 'vimeo:987654321',
    ...overrides,
  })
}
