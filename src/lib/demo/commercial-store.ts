import { DEFAULT_BETA_COHORT } from "@/lib/commercial/config";
import type { CommercialEvent } from "@/lib/commercial/events";

export const LEAD_COST_CONTROL_OPTIONS = [
  "planilha",
  "sistema_odontologico",
  "controle_manual",
  "nao_controlo",
  "outro",
] as const;

export type LeadCostControl = (typeof LEAD_COST_CONTROL_OPTIONS)[number];

export const LEAD_PIPELINE_STATUSES = [
  "novo",
  "contato_realizado",
  "demonstracao",
  "teste",
  "cliente",
  "nao_avancou",
] as const;

export type LeadPipelineStatus = (typeof LEAD_PIPELINE_STATUSES)[number];

export const CANCEL_REASONS = [
  "preco",
  "nao_entendeu_valor",
  "muito_dificil",
  "ja_usa_outro_sistema",
  "faltou_funcionalidade",
  "nao_e_prioridade",
  "outro",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

export const NON_CONVERSION_REASONS = CANCEL_REASONS;

export type CommercialLead = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  clinic_name: string | null;
  dentists_count: number;
  cost_control_today: LeadCostControl;
  pipeline_status: LeadPipelineStatus;
  non_conversion_reason: CancelReason | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BetaInvite = {
  id: string;
  code: string;
  max_uses: number;
  uses: number;
  cohort: string;
  active: boolean;
  created_at: string;
};

export type ClinicCommercialMeta = {
  clinic_id: string;
  beta_cohort: string | null;
  invite_code_used: string | null;
  entered_at: string;
  founder_pricing: boolean;
  commercial_offer: "trial" | "founder" | "standard" | null;
  health:
    | "onboarding_incomplete"
    | "activated"
    | "active"
    | "inactive"
    | null;
  last_operational_activity_at: string | null;
  activated_at: string | null;
};

export type CancelFeedback = {
  id: string;
  clinic_id: string;
  user_id: string;
  reason: CancelReason;
  detail: string | null;
  created_at: string;
};

export type CommercialStore = {
  leads: CommercialLead[];
  invites: BetaInvite[];
  clinic_meta: ClinicCommercialMeta[];
  events: CommercialEvent[];
  cancel_feedback: CancelFeedback[];
  /** idempotência simples de lead por e-mail+janela */
  lead_submit_locks: Record<string, number>;
};

declare global {
  var __sorriaCommercialStoreV1: CommercialStore | undefined;
}

function stamp() {
  return new Date().toISOString();
}

function seedInvites(): BetaInvite[] {
  const now = stamp();
  return [
    {
      id: "invite-beta-1",
      code: "SORRIA-BETA",
      max_uses: 20,
      uses: 0,
      cohort: DEFAULT_BETA_COHORT,
      active: true,
      created_at: now,
    },
    {
      id: "invite-demo",
      code: "SORRIA-DEMO",
      max_uses: 100,
      uses: 0,
      cohort: "demo_internal",
      active: true,
      created_at: now,
    },
  ];
}

function empty(): CommercialStore {
  return {
    leads: [],
    invites: seedInvites(),
    clinic_meta: [],
    events: [],
    cancel_feedback: [],
    lead_submit_locks: {},
  };
}

export function getCommercialStore(): CommercialStore {
  if (!globalThis.__sorriaCommercialStoreV1) {
    globalThis.__sorriaCommercialStoreV1 = empty();
  }
  return globalThis.__sorriaCommercialStoreV1;
}

export function resetCommercialStore() {
  globalThis.__sorriaCommercialStoreV1 = empty();
}
