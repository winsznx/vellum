import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16 runs Turbopack by default; pin the workspace root to this app (two lockfiles exist).
  turbopack: { root: __dirname },
  // Lean container output for Railway. Build runs via webpack (see package.json) — the
  // Turbopack prod optimizer hangs on the WASM-heavy relayer-sdk chunk.
  output: "standalone",
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
