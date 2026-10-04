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
| Plano de tratamento / Financeiro / Portal / IA | ❌ |

## Prontuário (Fase 4)

Rota: `/app/pacientes/[patientId]/prontuario`

Subtabs: Resumo clínico · Anamnese · Evoluções · Odontograma · Arquivos

### Services

```text
src/services/clinical/     # summary, entries, follow-up
src/services/anamnesis/
src/services/odontogram/
src/services/attachments/
```

### Integridade da evolução

```text
draft → editar livremente
     → finalizar (signed_at + versão 1)
     → correção = nova versão + motivo (versão anterior intacta)
```

Concorrência otimista via `expected_updated_at`.

### Retorno estruturado

`follow_up_required` + `follow_up_interval_days` na evolução.  
**Retorno pendente** = derivado (retorno indicado ∧ sem consulta futura).  
Não é `patient.status`.

### Anamnese

`template_version` permite evoluir perguntas sem invalidar respostas antigas.  
Alertas clínicos derivados das respostas (não diagnóstico).

## Fora do escopo atual

Plano de tratamento completo, financeiro, portal, Secretária Virtual, IA clínica, prescrição, interpretação de exames.
