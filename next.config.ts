import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // This allows Google Profile pics
      },
    ],
  },
  allowedDevOrigins: ['192.168.1.110', 'localhost:3000'],

};

export default nextConfig;
