/**
 * Shared mock for createMerchantClient().
 *
 * Usage in test files:
 *   vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
 */
import { vi } from 'vitest'

export const mockSellerContent = {
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  search: vi.fn(),
}

export const mockMerchantSales = {
  summary: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
}

export const mockMerchantUsers = {
  list: vi.fn(),
  invite: vi.fn(),
  remove: vi.fn(),
}

export const createMerchantClient = vi.fn().mockResolvedValue({
  seller: { content: mockSellerContent },
  merchant: {
    sales: mockMerchantSales,
    users: mockMerchantUsers,
  },
})
