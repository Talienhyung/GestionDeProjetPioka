// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2', 'sharp'],
  experimental: { serverActions: { bodySizeLimit: '30mb' } },
}

export default nextConfig
