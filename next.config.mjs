/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  assetPrefix: '.',
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: import.meta.dirname,
};
export default config;
