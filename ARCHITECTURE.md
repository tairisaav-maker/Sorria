# Architecture — Sorria

## Visão

Sorria é SaaS multi-clínica. A marca é independente; cada clínica é tenant (`clinic_id`).

## Identidade profissional

```text
Auth → Profile → Clinic Membership → Role → Permissions (+ clinical_access)
  → Resource/Tenant Check → RLS → Data
```

## Identidade Portal (paciente)

```text
auth.uid() → patient_portal_access (status=active)
  → clinic_id + patient_id → resource do próprio paciente
  → liberado ao paciente? → RLS → data
```

- Tabela `patient_portal_access` (N:N): prepara multi-clínica e responsável/dependente.
- E-mail igual a `patients.email` **não** autoriza.
- `patient_id` da URL **nunca** é autorização.
- Revogação (`revoked`) bloqueia Portal e signed URLs futuras.

**Owner administrativo ≠ acesso clínico universal.**  
Acesso clínico: papel `dentist` **ou** `owner` com `membership.clinical_access = true`.  
Acesso financeiro é independente do clínico.

## Domínios

| Domínio | Status |
| --- | --- |
| Equipe / permissões | ✅ |
| Pacientes administrativos | ✅ |
| Agenda / solicitações | ✅ |
| Prontuário | ✅ |
| Planos de tratamento | ✅ |
| Financeiro V1 | ✅ |
| Portal do paciente | ✅ (despriorizado na nav V1) |
| Relatórios e indicadores | ✅ |
| Secretária Virtual | ✅ (despriorizado na nav V1) |
| Onboarding / configs / produção | ✅ |
| Procedimentos + Estoque (Subfase 1) | ✅ fundação |
| Compras / movimentos / custo médio (Subfase 2) | ✅ |
| Procedimento do paciente / consumo real (Subfase 3) | ✅ |
| Previsão Agenda → materiais → estoque (Subfase 4) | ✅ |
| Procedimento + evolução + cobrado + financeiro (Subfase 5) | ✅ |

## Novo núcleo operacional

```text
Agenda → Atendimento → Procedimento → Materiais previstos
  → Consumo real → Estoque → Custo → Evolução → Financeiro
```

Navegação principal: Início · Agenda · Pacientes · Estoque · Financeiro · Mais  
Secundário: Procedimentos · Relatórios · Configurações  
Portal / Assistente: fora da nav principal (flags / Mais).

Services: `procedures/`, `inventory/` (+ `forecast`), `appointment-planned-procedures/`, `performed-procedures/`, `procedure-consumption/`, `procedure-costs/`, `patient-procedure-finance/`, `patient-summary/`  
Rotas: `/app/estoque/*` · `/app/estoque/previsao` · `/app/agenda/atendimento/[id]` · paciente → Procedimentos  
Fluxo: Agenda → Atendimento → Procedimento → Consumo confirmado → Baixa → Custo → Evolução → Financeiro  
Detalhes: [INVENTORY_AND_COSTS.md](./INVENTORY_AND_COSTS.md)

## Financeiro (Fase 6)

Rotas:

```text
/app/financeiro
/app/pacientes/[patientId]/financeiro
/app/estoque
/app/procedimentos
/app/relatorios
/app/assistente
/app/onboarding
/app/configuracoes/*
```

### Modelo

```text
FINANCIAL TRANSACTION (obrigação)
        ↓
PAYMENT INSTALLMENTS (parcelas)
        ↓
PAYMENTS (dinheiro real; estorno rastreável)
```

### Separações

```text
Plano aceito ≠ Receita
Parcela criada ≠ Pagamento recebido
Procedimento concluído ≠ Pagamento
Financeiro ≠ Prontuário
```

### Services

```text
src/services/finance/
```

Dashboard · list/get · create income/expense · cancel · installment plan from treatment · register/reverse payment · patient summary/history · export

### Dinheiro

- App: centavos inteiros (`src/lib/money.ts`)
- PostgreSQL: `numeric(12,2)`
- Parcelamento: residual na **última** parcela (`10000/3 → 3333+3333+3334`)
- Status `paid|partially_paid|overdue|pending|cancelled` **derivados**

### Regime de caixa (V1)

- **Recebido**: soma de pagamentos válidos (não estornados) de receitas no período
- **Despesas**: soma de pagamentos válidos de despesas no período
- **A receber / Vencido**: saldo de parcelas de receita em aberto (vencido se `due_date < hoje`)

### Tratamento → Financeiro

Plano aceito oferece `Criar condição de pagamento` (confirmação).  
Não altera `treatment_plan.total`. Desconto financeiro adicional é explícito na transação.

### Exportações

CSV (`;` + BOM UTF-8) · XLSX (exceljs) · PDF (pdfkit) — exigem `finance.export`.

### Concorrência / idempotência

- Pagamento > saldo → erro
- `client_request_id` único por clínica evita duplo clique

## Planos de tratamento (Fase 5)

Versionamento na apresentação; aceite amarra à versão.  
Progresso clínico derivado dos itens ≠ progresso financeiro.

## Portal do paciente (Fase 7)

Rotas: `/portal/*` — layout próprio (header desktop / bottom nav mobile).  
Não reutiliza sidebar profissional.

### Fluxo de horário

```text
Paciente solicita preferência → appointment_request
Clínica propõe → status proposed (ainda SEM appointment)
Paciente confirma → revalida disponibilidade → cria appointment
```

`request_type`: `new_appointment | reschedule | cancellation` na mesma tabela.  
Alteração/cancelamento = solicitação; agenda não muda sozinha.

### Services

```text
src/services/portal/
```

`getPortalContext` · `getMy*` · confirmação de proposta atômica · cópia de prontuário

### Documentos

Somente `patient_visible = true` + signed URL. Bucket permanece privado.

## Relatórios (Fase 8)

Rota: `/app/relatorios` (atalho em **Mais**).

Serviços: `src/services/reports/` — agregação server-side, permissões por seção (`reports.view_*`), drill-downs acionáveis, exportação PDF/XLSX/CSV.

Ocupação da agenda **não** é inventada sem horários de atendimento.

Definições: [REPORTS.md](./REPORTS.md).

## Secretária Virtual (Fase 9)

Rota: `/app/assistente`.

```text
UI → Orquestrador → Authz → Tool Registry → Services Sorria → RLS
```

- Provider abstrato (`AIProvider`); demo sem API externa
- Tools explícitas + permissão de domínio **antes** da execução
- Mutações via `assistant_action_plans` (TTL 15 min, confirmação explícita, revalidação)
- Sem SQL arbitrário, sem IA clínica, sem envio automático de mensagens

Detalhes: [ASSISTANT.md](./ASSISTANT.md).

## Produção (Fase 10)

Onboarding retomável · configurações de clínica/agenda/perfil/segurança · headers/CSP · health `/api/health` · feature flags · observabilidade abstrata · docs operacionais.

## Fora do escopo V1

Integração bancária/adquirente, boleto, NF, contabilidade, WhatsApp automático, cobrança SaaS do Sorria, IA clínica, pagamento online no Portal, BI externo, estoque, convênios.
