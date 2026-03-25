import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { config } from './config'

export interface SessionData {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  storeId?: string | null
  /** All stores the authenticated merchant can manage. */
  stores?: Array<{ id: string; name: string }>
}

function buildOptions(): SessionOptions {
  return {
    password: config.sessionSecret,
    cookieName: 'lw_session',
    cookieOptions: {
      secure: config.isProduction,
      httpOnly: true,
      // SameSite=Strict prevents the session cookie from being sent on any
      // cross-site request, providing CSRF protection for all state-mutating
      // API routes without needing a separate CSRF token. Safe here because
      // our Google auth flow uses the GIS client-side library (no server-side
      // redirect that would require the cookie on first arrival).
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  }
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), buildOptions())
}
