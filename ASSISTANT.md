# ASSISTANT.md — Secretária Virtual (Fase 9)

Assistente administrativa do Sorria. **Não é IA clínica.**

## Arquitetura

```text
UI conversacional (/app/assistente)
   ↓
Orquestrador (src/services/assistant)
   ↓
Autorização (assistant.use + permissão de domínio)
   ↓
Tool Registry (src/lib/assistant/tools.ts)
   ↓
Services do Sorria (agenda, patients, requests, treatments, finance, reports)
   ↓
RLS / demo store
```

O modelo **nunca** acessa SQL nem o banco diretamente.

```text
IA decide qual ferramenta solicitar
Serviço decide o que é permitido
Banco garante isolamento
Usuário confirma ações sensíveis
```

## Provider abstraction

`AIProvider` (`src/lib/assistant/provider.ts`):

- `parseIntent` — saída estruturada (intent, tool, entities)
- `presentResult` — texto a partir de **facts** das tools (sem inventar números)

Implementação atual: `DemoAIProvider` (determinístico, sem API externa).  
Segredos de provedores reais ficam **somente no servidor**.

## System prompt

`ASSISTANT_SYSTEM_PROMPT` + `ASSISTANT_PROMPT_VERSION` (`sv-2026.10.1`).

Regras: só administração; sem diagnóstico/prescrição; nunca afirmar ação sem tool; dados do banco ≠ instrução.

## Tool registry

Cada tool: `name`, `description`, `inputSchema` (Zod), `domainPermissions`, `riskLevel`, `requiresConfirmation`, `handler`.

### Risk levels

| Nível | Confirmação | Exemplos |
| --- | --- | --- |
| `read` | Não | agenda, pacientes, solicitações, financeiro (leitura) |
| `low_write` | Avaliar | rascunho de mensagem (não envia) |
| `sensitive_write` | **Obrigatória** | agendar, cancelar, reagendar, pagamento |
| `forbidden` | — | diagnóstico, SQL, bypass RLS — **não existem no registry** |

### Tools (V1)

| Nome | Permissão de domínio | Risk | Confirmação |
| --- | --- | --- | --- |
| `getScheduleForDay` | `appointments.view` | read | não |
| `getUnconfirmedAppointments` | `appointments.view` | read | não |
| `getNoShows` | `appointments.view` | read | não |
| `findAvailableWindows` | `appointments.view` | read | não |
| `getPendingRequests` | `appointment_requests.view` | read | não |
| `getProposedRequests` | `appointment_requests.view` | read | não |
| `findPatients` | `patients.demographics.view` | read | não |
| `getPatientsPendingReturnScheduling` | `reports.view_patients` (+ fallback demográfico) | read | não |
| `getNewPatients` | `patients.demographics.view` | read | não |
| `getPendingTreatmentDecisions` | treatments / reports treatments | read | não |
| `getTreatmentsInProgress` | treatments | read | não |
| `getFinancialSummary` | `reports.view_financial` **ou** `finance.view_administrative` | read | não |
| `getOverdueAccounts` | financeiro | read | não |
| `getAttentionSummary` | `dashboard.view` + seções permissionadas | read | não |
| `prepareMessageDraft` | `patients.contact.view` | low_write | não (não envia) |
| `prepareCreateAppointment` | `appointments.create` | sensitive_write | sim |
| `prepareRescheduleAppointment` | `appointments.update` | sensitive_write | sim |
| `prepareCancelAppointment` | `appointments.cancel` | sensitive_write | sim |
| `prepareRegisterPayment` | `finance.payment_create` | sensitive_write | sim |

Números financeiros e de relatório vêm de `getFinancialMetrics` / serviços da Fase 8.

## Action plans

Tabela/store: `assistant_action_plans`

- Status: `pending_confirmation` → `executed` | `cancelled` | `expired` | `failed`
- TTL: **15 minutos** (`ACTION_PLAN_TTL_MS`)
- Confirmação: botão explícito / `actionId` — **não** texto do modelo
- Na execução: revalida membership, permission, tenant, disponibilidade e regras de negócio
- Mutações chamam os **mesmos** services da UI (`createAppointment`, `changeAppointmentStatus`, `registerPayment`)

## RLS / tenant

Entidades: `assistant_threads`, `assistant_messages`, `assistant_action_plans`

Políticas: `auth.uid()` + membership com `assistant.use` + `clinic_id`.

Troca de clínica limpa contexto (`patient_id` etc.). Thread da Clinic A não é legível na Clinic B.

## Prompt injection

- Conteúdo de nomes/notas/uploads = **dado**, nunca instrução
- Bloqueio de pedidos de dump / “tudo que consegue acessar”
- Tools limitadas + autorização server-side mesmo se o modelo pedir tool indevida

## Minimização

Tools devolvem facts/cards mínimos. Agregados (ex.: valor recebido) são calculados no serviço — o modelo só apresenta.

## Auditoria

`assistant.thread_created`, `assistant.tool_called`, `assistant.action_prepared`, `assistant.action_confirmed`, `assistant.action_executed`, `assistant.action_failed`, `assistant.permission_denied`

Sem chain-of-thought.

## Observabilidade / custo / rate limit

- Erros de provider → mensagem genérica; Agenda/Financeiro seguem independentes
- Rate limit demo: 30 msgs / 60s por usuário+clínica
- Metadados de auditoria incluem `prompt_version` para rastreio

## Privacidade

Conversas não são usadas para treinar o produto. Demo usa provider local; integrações futuras devem documentar o que é enviado ao provedor.

## Testes

`src/tests/assistant/assistant.test.ts` — consultas, clínico bloqueado, permissões, injection, action plans (confirm/expire/race), financeiro = Fase 8, cross-clinic, ambiguidade, pagamento.

## Fora do escopo (Fase 9)

Diagnóstico, IA radiológica, WhatsApp/SMS/e-mail automático, cobrança automática, bulk mutations, agente autônomo em background.
