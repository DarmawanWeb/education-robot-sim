import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const monorepoRoot = path.join(process.cwd(), '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ['@taksu/ui', '@taksu/bali', '@taksu/content'],
  poweredByHeader: false,
  agentRules: false,
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
