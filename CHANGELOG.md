# Changelog

## 0.9.0-pilot — 2026-10-04

### Added
- **Piloto controlado:** preparação para uso real (sem novos módulos)
- Versão **Sorria 0.9.0-pilot** (`APP_CHANNEL=pilot`)
- Env `NEXT_PUBLIC_SORRIA_ENV` / `NEXT_PUBLIC_PILOT_MODE` + avisos em `/api/health`
- Instrumentação de eventos de produto sem PHI (`/api/demo/pilot`)
- Feedback rápido in-app (bug / dificuldade / sugestão)
- Painel `/app/piloto` — checklist de preparação + cobertura do fluxo
- Previsto × utilizado na ficha do procedimento (sugestão “Revisar ficha”)
- [PILOT_REPORT.md](./PILOT_REPORT.md) · [PILOT_CHECKLIST.md](./PILOT_CHECKLIST.md) · [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md)

### Notes
- Não é versão comercial final. Próximo passo: uso real → observar → corrigir.

## 1.10.0 — 2026-10-04

### Added
- **Subfase 10:** fluxo integrado V1 (Agenda → Atendimento → Consumo → Evolução → Custo → Financeiro)
- Home: quick actions, CTAs Iniciar/Continuar/Ver atendimento, consultas sem procedimento
- Tela de atendimento consolidada com blocos Procedimentos · Materiais · Evolução · Financeiro
- Onboarding V1 em 6 etapas (clínica → procedimentos → materiais → estoque → paciente → consulta)
- Busca global simples (paciente, procedimento, estoque)
- [V1_PRODUCT_FLOW.md](./V1_PRODUCT_FLOW.md)
- Suite E2E `src/tests/v1/fluxo-integrado-e2e.test.ts`

### Changed
- Perfil do paciente prioriza Resumo · Evolução · Procedimentos · Financeiro · Documentos
- Menu principal estável: Início · Agenda · Pacientes · Estoque · Financeiro

## 1.9.0 — 2026-10-04

### Added
- **Subfase 9:** preço, margem e comparação padrão × cobrado × custo
- Seção **Preço e custos** na ficha do procedimento + simuladores (preço, margem, diferença)
- `procedure_price_history` + `procedure.price_updated` (planos/snapshots preservados)
- Relatórios aba **Preços e margens**, cobertura, abaixo do custo, export
- Home card **Margens** (quando houver procedimentos abaixo do custo operacional)
- Permissions `procedure_pricing.*`, `procedures.update_price`, `reports.pricing_view`
- [PRICING_AND_MARGIN.md](./PRICING_AND_MARGIN.md)

## 1.8.0 — 2026-10-04

### Added
- **Subfase 8:** despesas gerais, custo/hora clínica e custo operacional do procedimento
- `/app/financeiro/custos` — configuração de horas, composição, simuladores
- Metadados em `financial_transactions` (fixa/variável, recorrência, alocável, competência)
- `clinic_cost_settings`, `recurring_expense_templates`, `clinic_hourly_cost_snapshots`
- Snapshot de custo/hora + duração em `performed_procedures` (histórico não recalcula silencioso)
- Permissions `clinic_costs.*`, `operational_costs.view`, `procedure_operational_costs.view`
- [OPERATIONAL_COSTING.md](./OPERATIONAL_COSTING.md)

## 1.7.0 — 2026-10-04

### Added
- **Subfase 7:** reposição inteligente e lista de compras em `/app/estoque/reposicao`
- `calculateReplenishmentNeeds`, embalagens com `ceil`, custo estimado, histórico como alerta
- `purchase_lists` / `purchase_list_items` (snapshot), compra parcial, conversão → compra real
- Permissions `inventory.replenishment_view`, `purchase_list_create`, `purchase_list_update`
- Home: card Estoque com resumo de reposição 7 dias
- [REPLENISHMENT.md](./REPLENISHMENT.md)

## 1.6.0 — 2026-10-04

### Added
- **Subfase 6:** dashboard operacional e rentabilidade em `/app/relatorios`
- Tabs: Visão geral · Procedimentos · Materiais · Pacientes · Financeiro
- Fórmulas centralizadas (resultado bruto, margem, previsto×real, cobertura de custos)
- Services `reports/operational/*`, export PDF/XLSX/CSV operacional, Home “Operação do mês”
- Permissions `reports.procedure_costs_view`, `reports.materials_view`, `reports.patient_financial_view`, `reports.financial_view`
- [OPERATIONAL_REPORTS.md](./OPERATIONAL_REPORTS.md)

## 1.5.0 — 2026-10-04

### Added
- **Subfase 5:** vínculo procedimento ↔ evolução ↔ valor cobrado ↔ financeiro (N:N)
- `performed_procedure_financial_links`, rateio proporcional de pagamentos, `financial_status`
- Resumo operacional do paciente e KPIs do dia (cobrado ≠ recebido)
- UI atendimento (resumo), aba Procedimentos enriquecida, Home operacional
- [PATIENT_PROCEDURE_FLOW.md](./PATIENT_PROCEDURE_FLOW.md)

## 1.4.0 — 2026-10-04

### Added
- **Subfase 4:** `appointment_planned_procedures` + previsão dinâmica de materiais
- `forecastMaterialNeeds`, `calculateAppointmentMaterialForecast`, conversão planned→performed
- UI `/app/estoque/previsao`, procedimentos previstos na Agenda, card Home (7 dias)
- Status: suficiente / ficará abaixo do mínimo / insuficiente; sem reserva de estoque
- Permissions `appointment_planned_procedures.*`, `inventory.forecast_view`, `inventory.forecast_cost_view`

## 1.3.0 — 2026-10-04

### Added
- **Subfase 3:** `performed_procedures`, `procedure_consumptions`, `appointment_consumptions`
- Snapshot da ficha, consumo previsto×real, material extra/substituto
- Baixa idempotente, rateio per_appointment, correção com histórico
- Custo/resultado bruto/margem por procedimento do paciente
- UI atendimento + aba Procedimentos no paciente; evolução e financeiro sem cobrança duplicada

## 1.2.0 — 2026-10-04

### Added
- **Subfase 2:** compras, purchase items (snapshot de conversão), movimentos, lotes
- Estoque inicial, ajuste por contagem, perda, vencimento, devolução, correção
- Custo médio ponderado aplicado nas entradas; cancelamento de compra com reversão
- UI `/app/estoque/compras`, `/movimentacoes`, detalhe do item; card Estoque na Home
- Permissões `inventory.movements_view`, `inventory.cost_view`

### Changed
- Cadastro de item não altera mais saldo nem custo médio (somente movimentos)

## 1.1.0 — 2026-10-04

### Changed
- **Reestruturação do produto (Subfase 1):** núcleo Agenda → Procedimento → Materiais → Estoque → Custo
- Navegação principal: Início, Agenda, Pacientes, Estoque, Financeiro; Portal/Assistente despriorizados

### Added
- Catálogo `procedures` + ficha `procedure_materials` + `inventory_items`
- Permissions/RLS; services; UI `/app/procedimentos`, `/app/estoque`
- Cálculo de consumo/custo padrão (centavos); modos per_appointment/per_procedure/per_unit/manual
- [INVENTORY_AND_COSTS.md](./INVENTORY_AND_COSTS.md)

### Not yet (próximas subfases)
- Compras, movimentos, custo médio ponderado aplicado
- Baixa automática / consumo real / previsão da agenda

## 1.0.0 — 2026-10-04

### Added
- Fases 0–9: fundação, authz, pacientes, agenda, prontuário, tratamentos, financeiro, portal, relatórios, Secretária Virtual
- FASE 10: onboarding retomável, configurações (clínica/agenda/perfil/segurança), checklist na Home
- Health check, security headers/CSP, rate limit de login, error/404 pages
- Feature flags (assistant/portal), observabilidade abstrata, versão 1.0.0
- Docs: SECURITY_MATRIX, BACKUP_AND_RECOVERY, DEPLOYMENT, OPERATIONS, produto

### Security
- RLS auditado nas entidades tenant; isolation cross-clinic testado
- Service role ausente do client bundle
- Placeholders Termos/Privacidade (revisão jurídica pendente)

### Notes
- Cobrança SaaS do Sorria **não** implementada
- IA clínica / WhatsApp / convênios fora do núcleo imediato
