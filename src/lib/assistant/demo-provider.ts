import type { AIProvider } from "@/lib/assistant/provider";
import { resolveNaturalDate } from "@/lib/assistant/dates";
import type { ParsedIntent } from "@/types/assistant";

/**
 * Provider determinístico para demo/testes — sem API externa.
 * Extrai intenção estruturada; números sempre vêm das tools.
 */
export class DemoAIProvider implements AIProvider {
  name = "demo-structured";

  async parseIntent(input: {
    messages: Array<{ role: string; content: string }>;
    allowedTools: string[];
    contextHint?: string;
  }): Promise<ParsedIntent> {
    const last = [...input.messages].reverse().find((m) => m.role === "user");
    const text = (last?.content ?? "").trim();
    const lower = text.toLowerCase();
    const allowed = new Set(input.allowedTools);

    const clinical =
      /diagn[oó]stic|doen[cç]a|radiograf|prescrev|anest[eé]sic|medicamento|progn[oó]stic|o que .* tem|melhor tratamento|analise a radiografia|analise o exame/.test(
        lower,
      );
    if (clinical) {
      return {
        intent: "clinical_blocked",
        tool_name: null,
        entities: {},
        needs_clarification: false,
        clinical_blocked: true,
        confidence: 1,
      };
    }

    if (/tudo que (voc[eê] )?consegue acessar|todos os dados|dump|exportar banco/.test(lower)) {
      return {
        intent: "exfiltration_blocked",
        tool_name: null,
        entities: {},
        needs_clarification: false,
        confidence: 1,
      };
    }

    const pick = (name: string) => (allowed.has(name) ? name : null);

    // Attention / summary
    if (/precisa da minha aten[cç][aã]o|resumo do consult[oó]rio|pend[eê]ncias do dia/.test(lower)) {
      return intent("attention", pick("getAttentionSummary"), {});
    }

    // Mutations first — "Agenda a Mariana…" must not match schedule read.
    // Temporal "agenda hoje/amanhã" is a read, not a booking.
    const bookingVerb =
      /(^|\s)(agenda[r]?|marca[r]?)\s+(a |o |as |os )?[a-záéíóúâêôãõç]/i.test(
        text,
      ) || /remarcar|reagendar/.test(lower);
    const scheduleReadPhrase =
      /agenda\s+(hoje|amanh|de |da |esta|para )|como est[aá].*agenda|minha agenda/i.test(
        text,
      );
    if ((bookingVerb && !scheduleReadPhrase) || /cancelar (a )?consulta/.test(lower)) {
      if (/cancelar/.test(lower)) {
        return intent("prepare_cancel", pick("prepareCancelAppointment"), {
          raw: text,
        });
      }
      if (/remarcar|reagendar/.test(lower)) {
        return intent("prepare_reschedule", pick("prepareRescheduleAppointment"), {
          raw: text,
          date: resolveNaturalDate(text),
        });
      }
      return intent("prepare_create", pick("prepareCreateAppointment"), {
        raw: text,
        date: resolveNaturalDate(text),
      });
    }

    // Payment
    if (/registra.*(pagou|pagamento)|pagou r\$|registrar pagamento/.test(lower)) {
      return intent("prepare_payment", pick("prepareRegisterPayment"), { raw: text });
    }

    // Unconfirmed
    if (/n[aã]o confirm|sem confirmar|aguardando confirma/.test(lower)) {
      const date = resolveNaturalDate(text);
      return intent("unconfirmed", pick("getUnconfirmedAppointments"), {
        date_ymd: date?.ymd,
        date_label: date?.label,
      });
    }

    // No-shows
    if (/faltou|faltas|no[_ ]?show/.test(lower)) {
      const date = resolveNaturalDate(text);
      return intent("no_shows", pick("getNoShows"), {
        date_ymd: date?.ymd,
        week: /semana/.test(lower),
      });
    }

    // Available windows
    if (/hor[aá]rio livre|janela|dispon[ií]vel|tenho hor[aá]rio/.test(lower)) {
      const date = resolveNaturalDate(text);
      return intent("availability", pick("findAvailableWindows"), {
        date_ymd: date?.ymd,
        date_label: date?.label,
        afternoon: /(^|[^a-zà-ú])tarde([^a-zà-ú]|$)/.test(lower),
        morning: /(^|[^a-zà-ú])manh[ãa]([^a-zà-ú]|$)/.test(lower),
      });
    }

    // Schedule today/tomorrow/date (read-only)
    if (
      /como est[aá].*agenda|agenda (de |para )?(hoje|amanh)|consultas? (de |para )?(hoje|amanh)|quantos pacientes.*(hoje|amanh)/.test(
        lower,
      )
    ) {
      const date = resolveNaturalDate(text) ?? resolveNaturalDate("hoje");
      return intent("schedule", pick("getScheduleForDay"), {
        date_ymd: date?.ymd,
        date_label: date?.label,
      });
    }

    // Requests
    if (/solicita[cç][oõ]es?|esperando proposta|pedidos? de hor[aá]rio/.test(lower)) {
      if (/proposta|proposto/.test(lower)) {
        return intent("requests_proposed", pick("getProposedRequests"), {});
      }
      return intent("requests_pending", pick("getPendingRequests"), {});
    }

    // Returns
    if (/precisa.? retornar|retornos? pend|agendar retorno|quem precisa retornar/.test(lower)) {
      return intent("pending_returns", pick("getPatientsPendingReturnScheduling"), {});
    }

    // Treatments
    if (/aguardando decis[aã]o|planos? apresentados?|aceitaram tratamento|tratamentos? em andamento/.test(lower)) {
      if (/andamento/.test(lower)) {
        return intent("treatments_progress", pick("getTreatmentsInProgress"), {});
      }
      return intent("treatment_decisions", pick("getPendingTreatmentDecisions"), {});
    }

    // Finance
    if (/recebi|a receber|vencid|parcelas? venc|financeiro|pr[oó]ximo vencimento/.test(lower)) {
      if (/vencid|inadimpl/.test(lower) && /quem|paciente/.test(lower)) {
        return intent("overdue_patients", pick("getOverdueAccounts"), {});
      }
      return intent("finance_summary", pick("getFinancialSummary"), {
        period_hint: /hoje/.test(lower)
          ? "today"
          : /semana/.test(lower)
            ? "week"
            : /m[eê]s/.test(lower)
              ? "month"
              : "month",
      });
    }

    // Find patient / phone
    if (/procure|busca|abra a |telefone d|qual o telefone|paciente /.test(lower)) {
      const name = extractName(text);
      if (name) {
        return intent("find_patient", pick("findPatients"), { query: name });
      }
    }

    // New patients
    if (/pacientes? novos?/.test(lower)) {
      return intent("new_patients", pick("getNewPatients"), {});
    }

    // Draft message
    if (/prepare uma mensagem|rascunho|lembrete/.test(lower)) {
      return intent("draft_message", pick("prepareMessageDraft"), { raw: text });
    }

    return {
      intent: "unknown",
      tool_name: null,
      entities: { raw: text },
      needs_clarification: true,
      clarification_prompt:
        "Posso ajudar com agenda, solicitações, pacientes, tratamentos ou financeiro (se autorizado). Como prefere proceder?",
      confidence: 0.3,
    };
  }

  async presentResult(input: {
    userMessage: string;
    toolName: string;
    toolResult: unknown;
    facts: string[];
  }): Promise<string> {
    if (input.facts.length === 0) {
      return "Não encontrei informações para essa consulta com os dados disponíveis.";
    }
    return input.facts.join("\n");
  }
}

function intent(
  name: string,
  tool: string | null,
  entities: Record<string, unknown>,
): ParsedIntent {
  return {
    intent: name,
    tool_name: tool,
    entities,
    needs_clarification: false,
    confidence: 0.9,
  };
}

function extractName(text: string): string | null {
  const m =
    text.match(
      /(?:procure|busca(?:r)?|abra|telefone d[aeo]?)\s+(?:a |o |as |os )?(?:paciente\s+)?([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{0,60})/i,
    ) || text.match(/\b(Mariana Oliveira|Jo[aã]o Pedro|Ana)\b/i);
  if (!m) return null;
  return m[1]!.trim().replace(/[?.!]+$/, "");
}

export function getAIProvider(): AIProvider {
  return new DemoAIProvider();
}
