import { assertPermission } from "@/lib/authz/guards";
import { can, type AuthzContext } from "@/lib/authz/can";
import { appendAudit } from "@/lib/demo/authz-store";
import { getAssistantStore } from "@/lib/demo/assistant-store";
import { getAIProvider } from "@/lib/assistant/demo-provider";
import { ASSISTANT_SYSTEM_PROMPT, ASSISTANT_PROMPT_VERSION } from "@/lib/assistant/prompt";
import { checkAssistantRateLimit } from "@/lib/assistant/rate-limit";
import { getTool, listToolNames } from "@/lib/assistant/tools";
import {
  ACTION_PLAN_TTL_MS,
  type AssistantActionPlan,
  type AssistantChatResponse,
  type AssistantContext,
  type AssistantMessage,
  type AssistantThread,
} from "@/types/assistant";
import {
  createAppointment,
  changeAppointmentStatus,
  rescheduleAppointment,
} from "@/services/appointments/mutations";
import { registerPayment } from "@/services/finance";
import { checkAvailability } from "@/services/appointments/availability";

function audit(
  ctx: AuthzContext,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: { ...metadata, prompt_version: ASSISTANT_PROMPT_VERSION },
  });
}

export function listThreads(ctx: AuthzContext) {
  assertPermission(ctx, "assistant.use");
  return getAssistantStore()
    .threads
    .filter((t) => t.clinic_id === ctx.clinicId && t.user_id === ctx.userId)
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
}

export function getThread(ctx: AuthzContext, threadId: string) {
  assertPermission(ctx, "assistant.use");
  const thread = getAssistantStore().threads.find((t) => t.id === threadId);
  if (!thread || thread.clinic_id !== ctx.clinicId || thread.user_id !== ctx.userId) {
    throw new Error("THREAD_NOT_FOUND");
  }
  const messages = getAssistantStore()
    .messages
    .filter((m) => m.thread_id === threadId)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  return { thread, messages };
}

export function createThread(ctx: AuthzContext, title?: string) {
  assertPermission(ctx, "assistant.use");
  const now = new Date().toISOString();
  const thread: AssistantThread = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    user_id: ctx.userId,
    title: title ?? null,
    context_json: { clinic_id: ctx.clinicId },
    created_at: now,
    updated_at: now,
  };
  getAssistantStore().threads.unshift(thread);
  audit(ctx, "assistant.thread_created", "assistant_thread", thread.id, {});
  return thread;
}

function pushMessage(
  ctx: AuthzContext,
  thread: AssistantThread,
  role: AssistantMessage["role"],
  content: string,
  meta: AssistantMessage["meta_json"] = {},
) {
  const msg: AssistantMessage = {
    id: crypto.randomUUID(),
    thread_id: thread.id,
    clinic_id: ctx.clinicId,
    user_id: ctx.userId,
    role,
    content,
    meta_json: meta,
    created_at: new Date().toISOString(),
  };
  getAssistantStore().messages.push(msg);
  thread.updated_at = msg.created_at;
  return msg;
}

function allowedToolsFor(_ctx: AuthzContext) {
  // Provider may only pick from registry; server still re-checks domain perms.
  void _ctx;
  return listToolNames().filter((name) => {
    const tool = getTool(name);
    if (!tool) return false;
    if (tool.riskLevel === "forbidden") return false;
    // soft filter: at least assistant.use; domain checked at execution
    return true;
  });
}

export async function sendAssistantMessage(
  ctx: AuthzContext,
  input: { threadId?: string | null; message: string },
): Promise<AssistantChatResponse> {
  assertPermission(ctx, "assistant.use");

  if (!checkAssistantRateLimit(ctx.userId, ctx.clinicId)) {
    const thread = input.threadId
      ? getThread(ctx, input.threadId).thread
      : createThread(ctx, "Conversa");
    const assistant_message = pushMessage(
      ctx,
      thread,
      "assistant",
      "Você enviou muitas mensagens em pouco tempo. Aguarde um momento e tente novamente.",
      {},
    );
    return {
      thread,
      messages: getThread(ctx, thread.id).messages,
      assistant_message,
      rate_limited: true,
    };
  }

  let thread: AssistantThread;
  if (input.threadId) {
    thread = getThread(ctx, input.threadId).thread;
  } else {
    thread = createThread(ctx, deriveTitle(input.message));
  }

  // Clinic context guard
  if (thread.context_json.clinic_id && thread.context_json.clinic_id !== ctx.clinicId) {
    thread.context_json = { clinic_id: ctx.clinicId };
  }

  pushMessage(ctx, thread, "user", input.message, {});

  const provider = getAIProvider();
  const history = getThread(ctx, thread.id).messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  let parsed;
  try {
    parsed = await provider.parseIntent({
      messages: [
        { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
        ...history,
      ],
      allowedTools: allowedToolsFor(ctx),
      contextHint: JSON.stringify(sanitizeContext(thread.context_json)),
    });
  } catch {
    const assistant_message = pushMessage(
      ctx,
      thread,
      "assistant",
      "A Secretária Virtual não conseguiu responder agora. Tente novamente.",
      {},
    );
    return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
  }

  if (parsed.clinical_blocked) {
    const assistant_message = pushMessage(
      ctx,
      thread,
      "assistant",
      "A Secretária Virtual é voltada à gestão administrativa do consultório e não realiza diagnóstico, prescrição nem interpretação clínica.",
      { clinical_blocked: true },
    );
    audit(ctx, "assistant.permission_denied", "assistant", thread.id, {
      reason: "clinical_blocked",
    });
    return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
  }

  if (parsed.intent === "exfiltration_blocked") {
    const assistant_message = pushMessage(
      ctx,
      thread,
      "assistant",
      "Posso ajudar com consultas objetivas sobre agenda, pacientes, solicitações, tratamentos ou financeiro — sempre dentro das suas permissões.",
      { denied: true },
    );
    return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
  }

  if (!parsed.tool_name) {
    const assistant_message = pushMessage(
      ctx,
      thread,
      "assistant",
      parsed.clarification_prompt ??
        "Não entendi o pedido. Experimente perguntar sobre a agenda de hoje ou solicitações pendentes.",
      {},
    );
    return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
  }

  const tool = getTool(parsed.tool_name);
  if (!tool) {
    const assistant_message = pushMessage(
      ctx,
      thread,
      "assistant",
      "Essa operação não está disponível.",
      { denied: true },
    );
    return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
  }

  // Authorization BEFORE tool
  for (const perm of tool.domainPermissions) {
    // Some tools accept alternate perms inside handler; pre-check primary
    if (
      tool.name.startsWith("getFinancial") ||
      tool.name === "getOverdueAccounts"
    ) {
      if (
        !can(ctx, "reports.view_financial").allowed &&
        !can(ctx, "finance.view_administrative").allowed
      ) {
        const assistant_message = pushMessage(
          ctx,
          thread,
          "assistant",
          "Você não tem permissão para consultar informações financeiras.",
          { denied: true },
        );
        audit(ctx, "assistant.permission_denied", "assistant_tool", tool.name, {
          permission: perm,
        });
        return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
      }
    } else if (!can(ctx, perm).allowed) {
      // allow alternate for treatment tools
      const altOk =
        (tool.name.includes("Treatment") &&
          (can(ctx, "treatments.view").allowed ||
            can(ctx, "reports.view_treatments").allowed)) ||
        (tool.name === "getPatientsPendingReturnScheduling" &&
          can(ctx, "patients.demographics.view").allowed);
      if (!altOk) {
        const assistant_message = pushMessage(
          ctx,
          thread,
          "assistant",
          "Você não tem permissão para esta consulta.",
          { denied: true },
        );
        audit(ctx, "assistant.permission_denied", "assistant_tool", tool.name, {
          permission: perm,
        });
        return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
      }
    }
  }

  let result;
  try {
    const entities = { ...parsed.entities };
    if (thread.context_json.patient_id && !entities.patient_id) {
      // context is hint only — tools still validate tenant
      entities.context_patient_id = thread.context_json.patient_id;
    }
    result = tool.handler(ctx, entities as Record<string, unknown>);
    audit(ctx, "assistant.tool_called", "assistant_tool", tool.name, {
      intent: parsed.intent,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "AUTHORIZATION_DENIED") {
      const assistant_message = pushMessage(
        ctx,
        thread,
        "assistant",
        "Você não tem permissão para esta consulta.",
        { denied: true },
      );
      audit(ctx, "assistant.permission_denied", "assistant_tool", tool.name, {});
      return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
    }
    const assistant_message = pushMessage(
      ctx,
      thread,
      "assistant",
      "Não foi possível concluir essa consulta agora.",
      {},
    );
    return { thread, messages: getThread(ctx, thread.id).messages, assistant_message };
  }

  // Update conversation context from tool data (minimal)
  if (result.data && typeof result.data === "object") {
    const d = result.data as { patient_id?: string; patient_name?: string };
    if (d.patient_id) {
      thread.context_json = {
        ...thread.context_json,
        clinic_id: ctx.clinicId,
        patient_id: d.patient_id,
        patient_name: d.patient_name ?? null,
      };
    }
  }

  let actionPlanId: string | undefined;
  let actionPreview = null;
  if (result.action_plan) {
    const plan = createActionPlan(ctx, thread.id, result.action_plan);
    actionPlanId = plan.id;
    actionPreview = plan.preview_json;
    audit(ctx, "assistant.action_prepared", "assistant_action_plan", plan.id, {
      action_type: plan.action_type,
    });
  }

  const text = await provider.presentResult({
    userMessage: input.message,
    toolName: tool.name,
    toolResult: result.data,
    facts: result.facts,
  });

  if (!thread.title) {
    thread.title = deriveTitle(input.message);
  }

  const assistant_message = pushMessage(ctx, thread, "assistant", text, {
    tool_name: tool.name,
    cards: result.cards,
    links: result.links,
    action_plan_id: actionPlanId,
    action_preview: actionPreview,
  });

  return {
    thread,
    messages: getThread(ctx, thread.id).messages,
    assistant_message,
  };
}

function createActionPlan(
  ctx: AuthzContext,
  threadId: string,
  plan: {
    action_type: string;
    payload: Record<string, unknown>;
    preview: AssistantActionPlan["preview_json"];
  },
) {
  const now = Date.now();
  const row: AssistantActionPlan = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    user_id: ctx.userId,
    thread_id: threadId,
    action_type: plan.action_type,
    payload_json: plan.payload,
    preview_json: plan.preview,
    status: "pending_confirmation",
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + ACTION_PLAN_TTL_MS).toISOString(),
    confirmed_at: null,
    executed_at: null,
    error_message: null,
  };
  getAssistantStore().actions.unshift(row);
  return row;
}

export function confirmActionPlan(ctx: AuthzContext, actionId: string) {
  assertPermission(ctx, "assistant.use");
  const store = getAssistantStore();
  const plan = store.actions.find((a) => a.id === actionId);
  if (!plan || plan.clinic_id !== ctx.clinicId || plan.user_id !== ctx.userId) {
    throw new Error("ACTION_NOT_FOUND");
  }
  if (plan.status !== "pending_confirmation") {
    throw new Error("ACTION_NOT_PENDING");
  }
  if (Date.now() > +new Date(plan.expires_at)) {
    plan.status = "expired";
    throw new Error("ACTION_EXPIRED");
  }

  // Revalidate + execute via domain services
  try {
    const result = executeAction(ctx, plan);
    plan.status = "executed";
    plan.confirmed_at = new Date().toISOString();
    plan.executed_at = plan.confirmed_at;
    audit(ctx, "assistant.action_confirmed", "assistant_action_plan", plan.id, {});
    audit(ctx, "assistant.action_executed", "assistant_action_plan", plan.id, {
      action_type: plan.action_type,
    });

    let assistant_message: AssistantMessage | null = null;
    if (plan.thread_id) {
      try {
        const { thread } = getThread(ctx, plan.thread_id);
        const successText =
          plan.action_type === "create_appointment"
            ? "Consulta agendada."
            : plan.action_type === "cancel_appointment"
              ? "Consulta cancelada."
              : plan.action_type === "register_payment"
                ? "Pagamento registrado."
                : plan.action_type === "reschedule_appointment"
                  ? "Consulta reagendada."
                  : "Ação executada.";
        assistant_message = pushMessage(ctx, thread, "assistant", successText, {
          tool_name: plan.action_type,
        });
      } catch {
        /* thread may be gone */
      }
    }

    return { plan, result, assistant_message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha";
    plan.status = "failed";
    plan.error_message = message;
    audit(ctx, "assistant.action_failed", "assistant_action_plan", plan.id, {
      error: message,
    });
    throw error;
  }
}

export function cancelActionPlan(ctx: AuthzContext, actionId: string) {
  assertPermission(ctx, "assistant.use");
  const plan = getAssistantStore().actions.find((a) => a.id === actionId);
  if (!plan || plan.clinic_id !== ctx.clinicId || plan.user_id !== ctx.userId) {
    throw new Error("ACTION_NOT_FOUND");
  }
  plan.status = "cancelled";
  return plan;
}

function executeAction(ctx: AuthzContext, plan: AssistantActionPlan) {
  const payload = plan.payload_json;
  if (plan.action_type === "reschedule_appointment") {
    assertPermission(ctx, "appointments.update");
    const availability = checkAvailability({
      clinicId: ctx.clinicId,
      professionalId: String(payload.professional_id),
      startAt: String(payload.start_at),
      endAt: String(payload.end_at),
      excludeAppointmentId: String(payload.appointment_id),
    });
    if (!availability.available) {
      throw new Error("SLOT_UNAVAILABLE");
    }
    return rescheduleAppointment(ctx, String(payload.appointment_id), {
      professional_id: String(payload.professional_id),
      start_at: String(payload.start_at),
      end_at: String(payload.end_at),
    });
  }
  if (plan.action_type === "create_appointment") {
    assertPermission(ctx, "appointments.create");
    const availability = checkAvailability({
      clinicId: ctx.clinicId,
      professionalId: String(payload.professional_id),
      startAt: String(payload.start_at),
      endAt: String(payload.end_at),
    });
    if (!availability.available) {
      throw new Error("SLOT_UNAVAILABLE");
    }
    return createAppointment(ctx, {
      patient_id: String(payload.patient_id),
      professional_id: String(payload.professional_id),
      start_at: String(payload.start_at),
      end_at: String(payload.end_at),
      reason: String(payload.reason ?? "Consulta"),
    });
  }
  if (plan.action_type === "cancel_appointment") {
    assertPermission(ctx, "appointments.cancel");
    return changeAppointmentStatus(ctx, String(payload.appointment_id), {
      status: "cancelled",
      reason: String(payload.reason ?? "Cancelado"),
    });
  }
  if (plan.action_type === "register_payment") {
    assertPermission(ctx, "finance.payment_create");
    return registerPayment(ctx, {
      installment_id: payload.installment_id,
      amount_reais: payload.amount_reais,
      payment_method: payload.payment_method,
      paid_at: payload.paid_at,
      client_request_id: payload.client_request_id,
    });
  }
  throw new Error("UNKNOWN_ACTION");
}

function deriveTitle(message: string) {
  const t = message.trim().slice(0, 48);
  return t.length < message.trim().length ? `${t}…` : t || "Nova conversa";
}

function sanitizeContext(ctx: AssistantContext): AssistantContext {
  return {
    clinic_id: ctx.clinic_id,
    patient_id: ctx.patient_id,
    patient_name: ctx.patient_name,
  };
}

export function getAssistantSuggestions(ctx: AuthzContext) {
  assertPermission(ctx, "assistant.use");
  const suggestions = [
    can(ctx, "appointments.view").allowed
      ? "Como está minha agenda hoje?"
      : null,
    can(ctx, "appointments.view").allowed
      ? "Quem ainda não confirmou amanhã?"
      : null,
    can(ctx, "appointment_requests.view").allowed
      ? "Tenho solicitações pendentes?"
      : null,
    can(ctx, "reports.view_patients").allowed ||
    can(ctx, "patients.demographics.view").allowed
      ? "Quem precisa retornar?"
      : null,
    can(ctx, "reports.view_financial").allowed ||
    can(ctx, "finance.view_administrative").allowed
      ? "Quanto recebi este mês?"
      : null,
    "O que precisa da minha atenção hoje?",
  ].filter(Boolean) as string[];
  return suggestions;
}

export { ASSISTANT_PROMPT_VERSION };
