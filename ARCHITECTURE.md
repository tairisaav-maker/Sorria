# Architecture — Sorria

## Visão

Sorria é um produto SaaS de gestão odontológica. A marca é independente; cada clínica é um tenant configurável (`clinic_id`).

## Perfis previstos

1. **Dentista / Proprietária** — acesso completo à clínica
2. **Secretária humana** — preparado na arquitetura; permissões restritas a dados administrativos
3. **Paciente** — portal futuro; acesso apenas aos próprios dados

## Princípios técnicos

- Multi-clínica desde o dia 1 (`clinic_id` em entidades da clínica)
- RLS no PostgreSQL/Supabase como controle primário de acesso
- Mobile-first com shell profissional (sidebar + bottom navigation)
- IA futura nunca executa ação crítica sem confirmação
- Dados clínicos tratados com restrições próprias (fases posteriores)

## Estrutura de pastas (Fase 0)

```text
src/
  app/                 # rotas App Router
    login/             # autenticação
    auth/              # callback Supabase + demo session
    app/               # área autenticada do profissional
  components/
    auth/              # formulários de autenticação
    brand/             # identidade Sorria
    home/              # widgets da Home (mock)
    layout/            # shell, sidebar, bottom nav
    ui/                # design system básico
  lib/
    mock/              # dados fictícios temporários
    supabase/          # clients browser/server/middleware
    validations/       # schemas Zod
  types/               # tipos de domínio
supabase/migrations/   # SQL versionado
```

## Autenticação

- Produção: Supabase Auth (e-mail/senha)
- Desenvolvimento sem projeto: `NEXT_PUBLIC_DEMO_MODE` + cookie `sorria_demo_session`
- Middleware protege `/app/*` e redireciona `/` → login ou home

## Camadas futuras (não implementadas na Fase 0)

- Agenda / solicitações de horário
- Pacientes e prontuário
- Financeiro e exportações
- Secretária Virtual
- Portal do Paciente
