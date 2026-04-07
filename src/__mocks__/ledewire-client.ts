/**
 * Shared mock for createMerchantClient().
 *
 * Usage in test files:
 *   vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
 */
import { createMockClient } from '@ledewire/node/testing'
import { vi } from 'vitest'

// vi.mocked(..., true) applies MaybeMockedDeep<T>, surfacing vi.MockedFunction
// types on every method so tests can call .mockResolvedValueOnce etc. directly.
const mockClient = vi.mocked(createMockClient(vi.fn), true)

export const mockSellerContent = mockClient.seller.content
export const mockMerchantSales = mockClient.merchant.sales
export const mockMerchantUsers = mockClient.merchant.users
export const mockMerchantPricingRules = mockClient.merchant.pricingRules
export const mockMerchantDomains = mockClient.merchant.domains

export const createMerchantClient = vi.fn().mockResolvedValue(mockClient)
