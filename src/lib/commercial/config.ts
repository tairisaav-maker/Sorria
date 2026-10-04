/**
 * Contato comercial e flags do beta — configuração centralizada.
 * Não hardcodar e-mail/WhatsApp em múltiplos componentes.
 */

export function getCommercialContact() {
  return {
    email: process.env.NEXT_PUBLIC_SORRIA_CONTACT_EMAIL ?? "contato@sorria.app",
    whatsapp: process.env.NEXT_PUBLIC_SORRIA_CONTACT_WHATSAPP ?? null,
    label: "Contato comercial",
  };
}

/** Beta fechado: signup exige invite code válido. */
export function isInviteOnlyBeta() {
  return process.env.COMMERCIAL_BETA_INVITE_ONLY === "true";
}

export function isCommercialBetaEnabled() {
  if (process.env.FEATURE_COMMERCIAL_BETA === "false") return false;
  return true;
}

/** Cohort padrão da primeira leva comercial. */
export const DEFAULT_BETA_COHORT = "beta_cohort_1";
