import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @budget-kit/ui ships TypeScript source, so Next compiles it.
  transpilePackages: ['@budget-kit/ui'],
};

export default nextConfig;
