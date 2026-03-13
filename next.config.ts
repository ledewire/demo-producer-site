import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow requests from localhost:3001.
  // VS Code dev container port-forwarding maps container:3000 → host:3001 when
  // the host's port 3000 is already occupied (e.g. by a locally-running API).
  // Without this, Next.js 15 rejects cross-origin POST requests with 403.
  allowedDevOrigins: ['localhost:3001'],

  // Override Cross-Origin-Opener-Policy to allow Google Sign-In.
  // VS Code's port-forwarding proxy injects COOP: same-origin, which blocks
  // the Google GSI popup from returning the credential via window.postMessage.
  // same-origin-allow-popups keeps isolation while allowing popups we opened.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ]
  },
}

export default nextConfig
