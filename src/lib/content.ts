/** Shared content types and UI constants used across content management pages. */

export interface ContentItem {
  id: string
  title: string
  content_type: string
  content_body?: string | null
  content_uri?: string | null
  external_identifier?: string | null
  price_cents: number
  visibility: string
  created_at?: string
  updated_at?: string
}

export interface MerchantPricingRule {
  id: string
  store_id: string
  url_pattern: string
  price_cents: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface MerchantDomainVerification {
  id: string
  store_id: string
  domain: string
  status: 'pending' | 'verified' | 'failed'
  txt_record_name: string
  txt_record_value: string
  verified_at?: string | null
  checked_at?: string | null
  created_at: string
}

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private (draft)' },
] as const

export const CONTENT_TYPE_OPTIONS = [
  { value: 'markdown', label: 'Markdown article' },
  { value: 'external_ref', label: 'External reference (video, PDF, link…)' },
] as const
