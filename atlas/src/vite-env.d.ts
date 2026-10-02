/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ATLAS_DATA?: "demo" | "supabase";
  readonly VITE_DEMO_PASSWORD?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/** Company files for the AI co-founder's knowledge search (dev and tests only; empty in production builds). */
declare module "virtual:atlas-knowledge" {
  const docs: { path: string; content: string }[];
  export default docs;
}
