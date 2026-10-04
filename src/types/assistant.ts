export const ASSISTANT_PROMPT_VERSION = "sv-2026.10.1";

export type AssistantRiskLevel =
  | "read"
  | "low_write"
  | "sensitive_write"
  | "forbidden";

export type AssistantActionStatus =
  | "pending_confirmation"
  | "confirmed"
  | "executed"
  | "cancelled"
  | "expired"
  | "failed";

export type AssistantMessageRole = "user" | "assistant" | "system";

export type AssistantThread = {
  id: string;
  clinic_id: string;
  user_id: string;
  title: string | null;
  context_json: AssistantContext;
  created_at: string;
  updated_at: string;
};

export type AssistantContext = {
  patient_id?: string | null;
  patient_name?: string | null;
  appointment_id?: string | null;
  clinic_id?: string | null;
};

export type AssistantMessage = {
  id: string;
  thread_id: string;
  clinic_id: string;
  user_id: string;
  role: AssistantMessageRole;
  content: string;
  meta_json: AssistantMessageMeta;
  created_at: string;
};

export type AssistantMessageMeta = {
  tool_name?: string;
  cards?: AssistantResultCard[];
  links?: AssistantNavLink[];
  action_plan_id?: string;
  action_preview?: AssistantActionPreview | null;
  denied?: boolean;
  clinical_blocked?: boolean;
};

export type AssistantResultCard = {
  title: string;
  value: string;
  hint?: string;
};

export type AssistantNavLink = {
  label: string;
  href: string;
};

export type AssistantActionPlan = {
  id: string;
  clinic_id: string;
  user_id: string;
  thread_id: string | null;
  action_type: string;
  payload_json: Record<string, unknown>;
  preview_json: AssistantActionPreview;
  status: AssistantActionStatus;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  executed_at: string | null;
  error_message: string | null;
};

export type AssistantActionPreview = {
  title: string;
  fields: Array<{ label: string; value: string }>;
  confirm_label: string;
  cancel_label: string;
};

export type ParsedIntent = {
  intent: string;
  tool_name: string | null;
  entities: Record<string, unknown>;
  needs_clarification: boolean;
  clarification_prompt?: string;
  clinical_blocked?: boolean;
  confidence: number;
};

export type AssistantChatResponse = {
  thread: AssistantThread;
  messages: AssistantMessage[];
  assistant_message: AssistantMessage;
  rate_limited?: boolean;
};

export const ACTION_PLAN_TTL_MS = 15 * 60_000;
