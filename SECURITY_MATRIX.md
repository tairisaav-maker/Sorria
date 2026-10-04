# SECURITY_MATRIX.md — Sorria V1

Legenda: **V** view · **C** create · **U** update · **X** cancel/delete/reverse · **—** sem acesso  
Patient = Portal. Owner administrativo ≠ clínico automático.

| Recurso | Owner | Dentist | Secretary | Patient (Portal) |
| --- | --- | --- | --- | --- |
| Dashboard / Home | V | V | V | — |
| Clínica (settings) | V/U | — | — | — |
| Equipe | V/C/U | — | — | — |
| Permissões | U | — | — | — |
| Pacientes admin | V/C/U | V/C/U | V/C/U | próprio (contato limitado) |
| Agenda | V/C/U/X | V/C/U | V/C/U/X | próprias + confirmar |
| Solicitações | V/U | V/U | V/U | criar / responder proposta |
| Prontuário | só com clinical_access | V/C/U | — | docs liberados |
| Tratamentos clínicos | só clinical_access | V/C/U | — | planos liberados |
| Tratamentos admin | V/U | V | V/U | — |
| Financeiro admin | V/C/U/X | — / autorizado | V/C/U/X | próprio resumo |
| Relatórios | por seção | agenda/pacientes/trat. | agenda/pacientes | — |
| Secretária Virtual | V (+ domínio) | V (+ domínio) | V (+ domínio) | — |
| Procedimentos (catálogo) | V/C/U | V/C/U | V | — |
| Custos de procedimento | V/U | V | — | — |
| Estoque (itens) | V/C/U + adjust/purchase/costs | V + movimentos | V/C/U + adjust/purchase/costs | — |
| Auditoria | V | — | — | — |
| Storage clínico | policies + perms | policies + perms | — | patient_visible + signed URL |

## Regras absolutas

- UUID conhecido ≠ autorização  
- Role ≠ permission (usar `can()`)  
- Clinic A ≠ Clinic B  
- IA ≠ banco / IA ≠ autorização  
- Owner ≠ acesso clínico universal  
