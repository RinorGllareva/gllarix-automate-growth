import { createDemoSource } from "./demo/demoSource";
import { createSupabaseSource } from "./supabaseSource";
import type { DataSource } from "./types";

const env = import.meta.env;

const pickSource = (): DataSource => {
  if (env.VITE_ATLAS_DATA === "supabase") {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("VITE_ATLAS_DATA=supabase needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
    }
    return createSupabaseSource(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  }
  return createDemoSource({ password: env.VITE_DEMO_PASSWORD || "atlas-demo" });
};

export const data: DataSource = pickSource();

export * from "./types";
