import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: projectDir,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
