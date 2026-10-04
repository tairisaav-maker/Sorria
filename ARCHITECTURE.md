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
| Portal / Relatórios completos / IA | ❌ |

## Financeiro (Fase 6)

Rotas:

```text
/app/financeiro
/app/pacientes/[patientId]/financeiro
/app/relatorios   # stub — Fase 8
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

## Fora do escopo atual

Integração bancária/adquirente, boleto, NF, contabilidade, Portal completo, Relatórios Fase 8, Secretária Virtual, IA.
