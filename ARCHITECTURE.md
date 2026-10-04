# Architecture — Sorria

## Visão

Sorria é SaaS multi-clínica. A marca é independente; cada clínica é tenant (`clinic_id`).

## Identidade (Fase 1)

```text
Auth → Profile → Clinic Membership → Role → Permissions
  → Resource/Tenant Check → RLS → Data
```

## Pacientes (Fase 2)

Cadastro administrativo do paciente ≠ prontuário clínico.

Services em `src/services/patients/`. UI não consulta Supabase diretamente.

## Agenda + Solicitações (Fase 3)

### Regra fundamental

```text
SOLICITAÇÃO DE HORÁRIO  ≠  CONSULTA
```

O paciente **nunca** agenda um slot disponível. Ele envia uma solicitação.
Profissionais autorizados podem criar consulta diretamente na agenda (sem `appointment_request`).

### Fluxos

```text
AGENDA → Dia/Semana/Mês → Horário livre → Nova consulta
  → Paciente → Data+duração → Validar disponibilidade → Consulta

PACIENTE → Solicita horário → Clínica analisa → Propõe horário
  → Paciente confirma → Revalidar disponibilidade → Criar CONSULTA
```

### Domínios

| Domínio | Nesta fase |
| --- | --- |
| Agenda administrativa | ✅ |
| Solicitações de horário | ✅ |
| Prontuário / anamnese / odontograma | ❌ placeholders |
| Financeiro real / WhatsApp / Portal / IA | ❌ |

### Services

```text
src/services/appointments/
  availability.ts   # overlap half-open; cancelled não bloqueia
  queries.ts        # list/get/next/last/today
  mutations.ts      # create/reschedule/status/cancel

src/services/appointment-requests/
  index.ts          # list/review/propose/reject/approve/cancel
```

### State machines

**Consulta:** `scheduled → confirmed → arrived → in_progress → completed`  
Alternativas: `cancelled`, `no_show` nos estados iniciais. Terminais: `completed`, `no_show`, `cancelled`.

**Solicitação:** `new → under_review → proposed → approved`  
Alternativas: `rejected`, `cancelled`. Proposta **não** cria appointment.

### Conflitos

Intervalos half-open `[start, end)`. Validação no servidor via `checkAvailability`.
Ao aprovar solicitação, disponibilidade é **revalidada** (race condition).

### Timezone

Timestamps em UTC no banco. UI apresenta no timezone da clínica (`clinics.timezone`, default `America/Sao_Paulo`).
Horário de funcionamento default 08–18 em `src/lib/agenda/hours.ts` — preparado para configuração futura.

### Rotas

- `/app/agenda` — Dia / Semana / Mês
- `/app/solicitacoes`
- `/app/pacientes/[patientId]` — Nova consulta, próxima/última consulta
- `/app/home` — KPIs reais de agenda/solicitações

## Fora do escopo atual

Prontuário, anamnese, evoluções, odontograma, tratamentos, financeiro, portal completo, Secretária Virtual, IA, WhatsApp automático.
