# Architecture — Sorria

## Visão

Sorria é SaaS multi-clínica. A marca é independente; cada clínica é tenant (`clinic_id`).

## Identidade

```text
Auth → Profile → Clinic Membership → Role → Permissions (+ clinical_access)
  → Resource/Tenant Check → RLS → Data
```

**Owner administrativo ≠ acesso clínico universal.**  
Acesso clínico: papel `dentist` **ou** `owner` com `membership.clinical_access = true`.

## Domínios

| Domínio | Status |
| --- | --- |
| Equipe / permissões | ✅ |
| Pacientes administrativos | ✅ |
| Agenda / solicitações | ✅ |
| Prontuário (anamnese, evoluções, odontograma, arquivos) | ✅ |
| Planos de tratamento | ✅ |
| Financeiro / Portal / IA | ❌ |

## Planos de tratamento (Fase 5)

Rotas:

```text
/app/pacientes/[patientId]/tratamentos
/app/pacientes/[patientId]/tratamentos/novo
/app/pacientes/[patientId]/tratamentos/[treatmentPlanId]
```

Fluxo:

```text
Criar plano → adicionar procedimentos → apresentar → aceite/recusa → execução → conclusão
```

### Separações

```text
Necessidade clínica → Plano → Aceite → Execução
Plano de tratamento ≠ Pagamento
Odontograma ≠ Orçamento
Valor apresentado ≠ Receita
Progresso clínico ≠ Progresso financeiro
```

### Services

```text
src/services/treatments/
```

Funções: list/get/create/update, itens (add/update/remove/reorder), present/accept/reject, start/complete/cancel item, complete plan, revision, duplicate, totals.

### State machines

**Plano:** `draft → presented → accepted → in_progress → completed`  
Alternativa: `presented → rejected`  
Revisão material: status volta a `draft` com `version_number++` (aceite anterior limpo).

**Item:** `planned → accepted → in_progress → completed` (ou `cancelled`).

### Dinheiro

- App: **centavos inteiros** (`*_cents`)
- PostgreSQL: `numeric(12,2)`
- Servidor recalcula `item.total`, `subtotal`, desconto e `total`
- Frontend só estima

### Desconto

`percent` (0–100) ou `fixed` (≥ 0). Total nunca negativo.

### Versionamento

Ao apresentar: snapshot em `treatment_plan_versions`.  
Alteração material após apresentação → nova revisão + reapresentação + novo aceite.  
Aceite referencia `accepted_version`.

### Integrações

- Odontograma: “Adicionar ao plano” com confirmação (pré-preenche; não cria sozinho)
- Evolução: “Adicionar ao plano” a partir de próximo passo (confirmação)
- Perfil do paciente: aba Tratamento com plano atual + progresso derivado
- Home: planos aguardando decisão · tratamentos em andamento

### Ativos (UI)

Filtro “Ativos” = `draft | presented | accepted | in_progress` (não é status de banco).

## Prontuário (Fase 4)

Rota: `/app/pacientes/[patientId]/prontuario`

Subtabs: Resumo clínico · Anamnese · Evoluções · Odontograma · Arquivos

### Integridade da evolução

```text
draft → editar livremente
     → finalizar (signed_at + versão 1)
     → correção = nova versão + motivo (versão anterior intacta)
```

## Fora do escopo atual

Financeiro (parcelas, pagamentos, caixa), Portal completo, Secretária Virtual, IA clínica, prescrição, interpretação de exames, relatórios completos.
