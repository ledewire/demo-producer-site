import { createClient } from '@ledewire/node'
import type { TokenStorage, StoredTokens } from '@ledewire/node'
import { getSession } from './session'
import { config } from './config'

/**
 * Creates a @ledewire/node client authenticated via the stored merchant session.
 *
 * No API key or secret is required — the merchant token issued by
 * loginWithEmail() or loginWithGoogle() is sufficient for all content
 * management operations.
 *
 * Token refresh is handled transparently by the SDK; updated tokens are
 * persisted back into the httpOnly session cookie via the storage adapter.
 */
export async function createMerchantClient() {
  const session = await getSession()

  const storage: TokenStorage = {
    async getTokens(): Promise<StoredTokens | null> {
      if (!session.accessToken) return null
      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? '',
        expiresAt: session.expiresAt ?? 0,
      }
    },
    async setTokens(tokens: StoredTokens): Promise<void> {
      session.accessToken = tokens.accessToken
      session.refreshToken = tokens.refreshToken
      session.expiresAt = tokens.expiresAt
      await session.save()
    },
    async clearTokens(): Promise<void> {
      await session.destroy()
    },
  }

  return createClient({
    baseUrl: config.ledewireBaseUrl,
    storage,
    onAuthExpired: () => {
      // The route handler catches AuthError and redirects to /login.
    },
  })
}
