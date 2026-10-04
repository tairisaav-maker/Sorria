export type SorriaEnv = "development" | "pilot" | "staging" | "production";

export function getSorriaEnv(): SorriaEnv {
  const raw = (process.env.NEXT_PUBLIC_SORRIA_ENV ?? "").toLowerCase();
  if (raw === "pilot" || raw === "staging" || raw === "production") {
    return raw;
  }
  return "development";
}

/** Piloto controlado: dados reais, sem seed demo misturado. */
export function isPilotMode() {
  if (process.env.NEXT_PUBLIC_PILOT_MODE === "true") return true;
  return getSorriaEnv() === "pilot";
}

/**
 * Demo stores em memória só para development/local.
 * Em pilot/staging/production com Supabase: DEMO_MODE deve ser false.
 */
export function pilotEnvWarnings(): string[] {
  const warnings: string[] = [];
  const env = getSorriaEnv();
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if ((env === "pilot" || env === "staging" || env === "production") && demo) {
    warnings.push(
      "DEMO_MODE está ativo neste ambiente — dados demo não devem misturar com piloto real.",
    );
  }
  if (env === "pilot" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    warnings.push(
      "Piloto sem SUPABASE_URL — configure projeto Supabase separado do development.",
    );
  }
  return warnings;
}
