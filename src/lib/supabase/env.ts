import type { Database } from "@/types/database";

/**
 * Lê env público do Supabase.
 * Placeholders (`your-project`) contam como NÃO configurado —
 * em development/demo o app deve usar stores locais, não chamar a rede.
 */
export function getSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) return null;
  if (url.includes("your-project")) return null;
  if (anonKey === "your-anon-key") return null;
  return { url, anonKey };
}

export function hasSupabaseConfig(): boolean {
  return getSupabasePublicEnv() !== null;
}

export function requireSupabasePublicEnv(): { url: string; anonKey: string } {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Supabase não configurado. Em development use NEXT_PUBLIC_DEMO_MODE=true, ou defina URL/anon reais.",
    );
  }
  return env;
}

export type { Database };
