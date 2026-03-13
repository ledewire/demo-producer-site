/**
 * Centralised, eagerly-validated environment configuration.
 *
 * All required vars are validated at module load time so a misconfigured
 * server fails immediately on startup rather than on the first request.
 *
 * Usage:
 *   import { config } from '@/lib/config'
 *   config.ledewireBaseUrl   // string
 *   config.sessionSecret     // string
 *   config.googleClientId    // string | undefined
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Copy .env.example to .env.local and fill in all required values.`,
    )
  }
  return value
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined
}

function buildConfig() {
  const sessionSecret = required('SESSION_SECRET')
  if (sessionSecret.length < 32) {
    throw new Error(
      `SESSION_SECRET must be at least 32 characters. ` +
        `Generate one with: openssl rand -hex 32`,
    )
  }

  return {
    /** LedeWire REST API base URL — override to point at staging. */
    ledewireBaseUrl: optional('LEDEWIRE_BASE_URL') ?? 'https://api.ledewire.com',

    /** iron-session encryption secret (≥32 chars). */
    sessionSecret,

    /**
     * Google OAuth client ID rendered into the GSI script tag.
     * Optional — Google Sign-In is disabled when absent.
     */
    googleClientId: optional('NEXT_PUBLIC_GOOGLE_CLIENT_ID'),

    /** true in production builds (used for secure-cookie flag). */
    isProduction: process.env.NODE_ENV === 'production',
  } as const
}

export const config = buildConfig()
