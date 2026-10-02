import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vite.config";

// QA sweep (npm run test:qa): renders every route for every role. Kept out of `npm test` because it is CPU-heavy
// and would skew the timing checks there.
export default mergeConfig(base, defineConfig({ test: { include: ["src/test/qa/**/*.qa.tsx"], testTimeout: 600_000 } }));
