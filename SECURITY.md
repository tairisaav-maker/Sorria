# Security — Sorria

## Controles da Fase 0

- Supabase Auth para sessões reais
- Middleware bloqueia `/app/*` sem sessão (Supabase ou demo)
- RLS habilitado em `clinics`, `profiles`, `clinic_members`
- Políticas baseadas em membership/owner
- `.env*` versionado apenas via `.env.example`
- Service role nunca exposto no client

## Políticas RLS (resumo)

### profiles

- SELECT: próprio perfil ou colegas da mesma clínica
- INSERT/UPDATE: apenas o próprio usuário

### clinics

- SELECT: membros ativos
- UPDATE: owners
- INSERT: autenticados (bootstrap da clínica)

### clinic_members

- SELECT: próprio vínculo ou membros da clínica
- INSERT: owner, ou primeiro owner no bootstrap
- UPDATE/DELETE: owner

## Regras de produto (já vigentes conceitualmente)

- Dados clínicos ≠ dados administrativos
- Paciente nunca vê dados de outro paciente
- Nenhuma IA executa ação crítica silenciosamente
- Ações destrutivas exigem confirmação da profissional
- Demo mode apenas para desenvolvimento/UI — não usar em produção com dados reais

## Checklist antes de produção

- [ ] Desativar `NEXT_PUBLIC_DEMO_MODE`
- [ ] Rotacionar chaves Supabase
- [ ] Revisar policies após novas tabelas
- [ ] Auditoria de ações sensíveis
- [ ] Separar permissões clínicas vs administrativas
