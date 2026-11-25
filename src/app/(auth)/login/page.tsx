import { connection } from 'next/server'
import { createClient } from '@ledewire/node'
import { config } from '@/lib/config'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  // Render on each request. Otherwise Next prerenders this page at build time
  // and fixes the Google client ID (or its absence) until the next deploy.
  // Must stay outside the try: it throws to stop prerendering.
  await connection()

  let googleClientId: string | null = null
  try {
    const client = createClient({ baseUrl: config.ledewireBaseUrl })
    const publicConfig = await client.config.getPublic()
    googleClientId = publicConfig.google_client_id ?? null
  } catch (err) {
    // If the public config fetch fails, the login page still works —
    // Google Sign-In is simply hidden until the API is reachable.
    console.error('[login] public config fetch failed; Google Sign-In hidden', err)
  }

  return <LoginForm googleClientId={googleClientId} />
}
