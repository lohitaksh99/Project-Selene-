import type {NextConfig} from 'next';
import {PHASE_DEVELOPMENT_SERVER} from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    allowedDevOrigins: [
      'ais-dev-jjudl6ytcwdj6vcxbataeo-207098358091.asia-northeast1.run.app',
      'ais-pre-jjudl6ytcwdj6vcxbataeo-207098358091.asia-northeast1.run.app',
      '*.asia-northeast1.run.app',
      '*.run.app',
      'localhost:3000',
      'localhost:8080',
    ],
    reactStrictMode: true,
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: false,
    },
    // Allow access to remote image placeholder and serve modern compressed formats.
    images: {
      formats: ['image/avif', 'image/webp'],
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'picsum.photos',
          port: '',
          pathname: '/**', // This allows any path under the hostname
        },
      ],
    },
    output: 'standalone',
    serverExternalPackages: ['better-sqlite3'],
    transpilePackages: ['motion', 'three'],
    experimental: {
      optimizePackageImports: ['lucide-react', 'recharts', 'motion'],
    },
    webpack: (config, {dev}) => {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      if (dev && process.env.DISABLE_HMR === 'true') {
        config.watchOptions = {
          ignored: /.*/,
        };
      }
      return config;
    },
  };
}

