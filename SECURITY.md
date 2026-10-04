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
