# Security — Sorria

## Princípios

**Deny by default · Least privilege · Defense in depth · Tenant isolation**

## Regras estruturais

```text
Administrativo ≠ Clínico
Agenda ≠ Prontuário
Plano de tratamento ≠ Prontuário completo
Plano aceito ≠ Pagamento / Receita
Financeiro ≠ Prontuário
Acesso clínico ≠ Acesso financeiro
Owner administrativo ≠ acesso clínico universal
Clinic A ≠ Clinic B
Pagamento ≠ DELETE silencioso
```

## Financeiro (Fase 6)

| Key | Uso |
| --- | --- |
| `finance.view_administrative` | Dashboard e financeiro geral |
| `finance.view_authorized` | Visão limitada (ex.: paciente) — preparada |
| `finance.transaction_create` | Criar receitas/obrigações |
| `finance.transaction_update` | Cancelar lançamentos |
| `finance.payment_create` | Registrar pagamento |
| `finance.payment_reverse` | Estornar com motivo |
| `finance.expense_create` | Despesas |
| `finance.export` | CSV/XLSX/PDF |

- Secretária: financeiro admin + pagamentos; clínico **NEGADO**
- Dentista padrão: só `view_authorized` (sem dashboard geral / sem criar pagamento)
- Dentista sem financeiro: clínico ok, financeiro negado (teste de domínio)
- Owner: financeiro completo da clínica; clínico só com `clinical_access`
- Cross-clinic / refs maliciosas (patient/treatment de outra clínica) → not found
- Sem permissão: sem badges/KPIs financeiros na Home
- Exportações: sem dados clínicos; sem CPF completo

## Planos / Prontuário

Ver Fases 4–5. Versionamento; owner ≠ clínico universal.

## Cadeia

```text
Auth → Membership → Clinic → Permission (+ clinical_access) → Tenant Check → RLS → Data
```

## Portal do paciente (Fase 7)

```text
auth.uid() → patient_portal_access(active) → clinic_id + patient_id → resource
```

- E-mail coincidente com `patients.email` **não** concede acesso
- UUID conhecido **não** concede acesso
- Cross-patient / cross-clinic → NEGADO
- Acesso `revoked` → bloqueio imediato
- Paciente **não** recebe permissões profissionais (`clinical_record.view`, etc.)
- Appointments: paciente só lê próprios; confirma presença (`scheduled→confirmed`); não edita horário/profissional
- Requests: cria/responde próprias; não aprova arbitrariamente nem define proposta
- Treatments / finance: camada `getMy*` + RLS; sem despesas da clínica
- Attachments: `patient_visible = true` obrigatório; Storage privado + signed URL
- Perfil: campos de contato; CPF mascarado; `clinic_id`/`patient_id`/`cpf` imutáveis pelo Portal
- Auditoria: eventos `patient.*` / `portal.*` sem senha/token; paciente não vê audit log


## Procedures / Inventory / Patient finance (Reestruturação Subfases 1–6)

| Key | Uso |
| --- | --- |
| `procedures.*` / `procedure_costs.*` | Catálogo e custos padrão |
| `appointment_planned_procedures.view/create/update` | Procedimentos previstos na Agenda |
| `performed_procedures.view/create/update/complete` | Execução no paciente |
| `procedure_consumption.view/update/confirm/correct` | Previsto × real / baixa / correção |
| `inventory.*` | Itens, compras, movimentos, custos de estoque |
| `inventory.forecast_view` | Previsão de materiais pela Agenda |
| `inventory.forecast_cost_view` | Custo estimado da previsão |
| `reports.procedure_costs_view` | Custos / resultado bruto / margem nos relatórios |
| `reports.materials_view` | Consumo de materiais nos relatórios |
| `reports.patient_financial_view` | Financeiro por paciente nos relatórios |
| `reports.financial_view` | Aba financeiro operacional |
| `inventory.replenishment_view` | Necessidade de reposição |
| `inventory.purchase_list_create` | Criar lista de compras |
| `inventory.purchase_list_update` | Editar/cancelar/converter lista |

- Clinic A ≠ Clinic B (planned, performed, consumo, compra, lote, movimento, forecast, links financeiros, **agregados de relatório**, **listas/reposição**)
- Cross-patient: procedimento ≠ transação/evolução de outro paciente
- Custos monetários exigem `procedure_costs.view` / `inventory.cost_view` / `inventory.forecast_cost_view` / `reports.procedure_costs_view`
- Recebido/saldo exigem `finance.view_*` / `reports.patient_financial_view`
- Payload de relatório **omite** custos/margem sem permissão (não só esconde no UI)
- Reposição: sem `inventory.cost_view` → quantidades sem preço estimado no payload
- Drill-down de materiais/reposição: nome de paciente só com `patients.demographics.view`
- Lista de compras não é compra; conversão exige `inventory.purchase_create`
- Previsão não baixa estoque; baixa só após confirmação de consumo (Subfase 3)
- Cobrança ≠ pagamento; antiduplicidade com plano já faturado
- Conversão planned→performed idempotente
- Servidor é autoridade nos cálculos e no rateio

## Preço e margem (Subfase 9)

- Permissions: `procedure_pricing.view|manage`, `procedures.update_price`, `reports.pricing_view`
- Secretária: sem margens/custos operacionais no payload por padrão
- Dentista: `procedure_pricing.view`; alteração de preço exige `procedures.update_price`
- Cross-clinic: histórico e simulações isolados por `clinic_id`
- Auditoria: `procedure.price_updated`, `procedure.pricing_viewed` (não audita slider)
- Detalhes: [PRICING_AND_MARGIN.md](./PRICING_AND_MARGIN.md)

## Custeio operacional (Subfase 8)

- Permissions: `clinic_costs.view|manage`, `operational_costs.view`, `procedure_operational_costs.view`, `expense_categories.manage`, `cost_reports.view`
- Secretária: pode registrar despesas (`finance.expense_create`); **sem** custo/hora/margem por padrão
- Dentista: `procedure_operational_costs.view` — custo do próprio procedimento; sem gestão de custos da clínica
- Owner/gestor: configuração de horas, templates, composição do custo/hora
- Cross-clinic: settings, templates, snapshots e despesas isolados por `clinic_id`
- Snapshots de custo/hora não são atualizados (histórico imutável)
- Detalhes: [OPERATIONAL_COSTING.md](./OPERATIONAL_COSTING.md)

## Relatórios (Fase 8 + Subfase 6)

- Acesso por seção: `reports.view_*` / `reports.*_view` — API não retorna dados de seções negadas
- Secretária: agenda + materiais + financeiro operacional permitido; **sem** margem/resultado bruto sem `reports.procedure_costs_view`
- Dentista: procedimentos/consumo; custos/financeiro conforme permission
- Owner admin: todas as seções + export
- Portal paciente: sem acesso a `/app/relatorios`
- Exportação audita `report.exported` sem armazenar o arquivo
- Cross-clinic: membership obrigatória; sem contagem agregada entre clínicas
- Detalhes: [OPERATIONAL_REPORTS.md](./OPERATIONAL_REPORTS.md)

## Secretária Virtual (Fase 9)

- Permissão de entrada: `assistant.use` (+ permissão de domínio por tool)
- Sem `assistant.all_access` / sem SQL gerado pelo modelo / sem tool clínica genérica
- Autorização **antes** da tool; RLS em `assistant_threads` / `messages` / `action_plans`
- Action plans: confirmação explícita, TTL, revalidação, serviços de domínio existentes
- Prompt injection: conteúdo do banco = dado; dumps bloqueados
- Minimização: agregados nas tools; modelo não soma financeiro
- Dentista com prontuário ≠ Secretária como IA clínica
- Auditoria: `assistant.*` sem chain-of-thought; rate limit por usuário/tenant
- Detalhes: [ASSISTANT.md](./ASSISTANT.md)

## Produção (Fase 10)

- Headers: CSP, frame deny, nosniff, referrer, permissions-policy; HSTS em production
- Rate limit de login; rate limit da Secretária
- Health: `/api/health` sem secrets; AI down ≠ app down
- `clinic.settings`; status `active|suspended|closed`
- Service role apenas server-side (não usado no client)
- Matriz: [SECURITY_MATRIX.md](./SECURITY_MATRIX.md)
- Termos/Privacidade: placeholders — revisão jurídica antes do comercial
- Controles técnicos ≠ declaração automática de “100% LGPD”
