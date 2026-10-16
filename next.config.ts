// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Le badge d'outils de dev de Next se superpose à la barre de navigation
  // du site, qui est en bas d'écran.
  devIndicators: false,
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2', 'sharp'],
  experimental: { serverActions: { bodySizeLimit: '30mb' } },
}

export default nextConfig
