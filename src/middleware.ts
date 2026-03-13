import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Lightweight cookie-presence guard. Full session validation (including token
// expiry) happens inside each Server Component via requireAuth() in lib/auth.ts,
// which will redirect to /login on any failure.
export function middleware(request: NextRequest) {
  const session = request.cookies.get('lw_session')
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/content/:path*', '/users/:path*'],
}
