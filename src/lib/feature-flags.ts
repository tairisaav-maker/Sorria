import type { DemoClinic } from "@/lib/demo/authz-store";

export type FeatureFlags = {
  assistant_enabled: boolean;
  portal_enabled: boolean;
  /** Beta comercial — onboarding/ativação e ofertas especiais. */
  commercial_beta: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  assistant_enabled: true,
  portal_enabled: true,
  commercial_beta: true,
};

export function clinicFlags(clinic: DemoClinic | null | undefined): FeatureFlags {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...(clinic?.feature_flags ?? {}),
  };
}

/** Env-level kill switches (server). */
export function envFlags(): FeatureFlags {
  return {
    assistant_enabled: process.env.FEATURE_ASSISTANT_ENABLED !== "false",
    portal_enabled: process.env.FEATURE_PORTAL_ENABLED !== "false",
    commercial_beta: process.env.FEATURE_COMMERCIAL_BETA !== "false",
  };
}

export function isAssistantEnabled(clinic: DemoClinic | null | undefined) {
  return envFlags().assistant_enabled && clinicFlags(clinic).assistant_enabled;
}

export function isPortalEnabled(clinic: DemoClinic | null | undefined) {
  return envFlags().portal_enabled && clinicFlags(clinic).portal_enabled;
}
