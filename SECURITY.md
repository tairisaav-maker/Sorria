# Security — Sorria

## Princípios

**Deny by default · Least privilege · Defense in depth · Tenant isolation**

## Regras estruturais

```text
Administrativo ≠ Clínico
Agenda ≠ Prontuário
Plano de tratamento ≠ Prontuário completo
Plano aceito ≠ Pagamento
Valor apresentado ≠ Receita
Rascunho ≠ Registro finalizado
Correção / revisão ≠ Sobrescrita silenciosa
Owner administrativo ≠ acesso clínico universal
Arquivo privado ≠ URL pública
Clinic A ≠ Clinic B
```

## Planos de tratamento (Fase 5)

Permissões:

| Key | Uso |
| --- | --- |
| `treatments.view` | Visão clínica do plano |
| `treatments.administrative_view` | Visão administrativa (valores/status) |
| `treatments.create` | Criar plano |
| `treatments.update` | Editar rascunho / revisar |
| `treatments.present` | Apresentar |
| `treatments.acceptance_manage` | Aceite / recusa |
| `treatments.progress_update` | Iniciar/concluir itens |

- Dentista: permissões clínicas de tratamento
- Secretária: `administrative_view` + present + acceptance — **sem** anamnese/evolução/arquivos clínicos
- Owner: administrativo do plano por padrão; clínico de tratamento só com `clinical_access`
- Source IDs (odontograma/evolução): mesma clínica + mesmo paciente ou negado
- Cross-clinic: UUID conhecido → not found
- Aceite de plano vencido: bloqueado (revisar/reapresentar)
- Concorrência: `expected_updated_at`
- Audit: created/updated/presented/accepted/rejected/revised/completed + item started/completed/cancelled — sem dump clínico completo
- Versionamento: snapshot na apresentação; alteração material → nova revisão

## Prontuário (Fase 4)

Permissões: `clinical_record.*`, `anamnesis.*`, `clinical_evolution.*`, `odontogram.*`, `clinical_files.*`

- Secretária: clínico **NEGADO**
- Owner: clínico somente com `clinical_access`
- Storage: bucket privado; signed URL temporária; path tenant-bound

## Cadeia

```text
Auth → Membership → Clinic → Permission (+ clinical_access) → Tenant Check → RLS → Data/Storage
```
