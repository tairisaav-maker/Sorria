# Architecture — Sorria

## Visão

Sorria é SaaS multi-clínica. A marca é independente; cada clínica é tenant (`clinic_id`).

## Identidade (Fase 1)

```text
Auth → Profile → Clinic Membership → Role → Permissions
  → Resource/Tenant Check → RLS → Data
```

## Pacientes (Fase 2)

```text
PACIENTES → Buscar/Filtrar → Perfil → Resumo administrativo
                ↓
         Editar / Arquivar / Ação rápida
```

Cadastro:

```text
+ Novo paciente → Dados essenciais → Duplicidade → Salvar → Perfil
```

### Domínios

| Domínio | Nesta fase |
| --- | --- |
| Administrativo (demographics/contact/administrative) | ✅ |
| Clínico (prontuário, anamnese, odontograma…) | ❌ só placeholders |

**Administrative Patient Data ≠ Clinical Record Access**

### Services

```text
src/services/patients/
  queries.ts      # list/search/get + paginação 25
  mutations.ts    # create/update/archive/reactivate
  duplicates.ts   # CPF > telefone > e-mail > nome+nascimento
```

UI não consulta Supabase diretamente.

### Rotas

- `/app/pacientes`
- `/app/pacientes/novo`
- `/app/pacientes/[patientId]`
- `/app/pacientes/[patientId]/editar`

## Fora do escopo atual

Agenda, prontuário, tratamento, financeiro, portal, IA, WhatsApp oficial.
