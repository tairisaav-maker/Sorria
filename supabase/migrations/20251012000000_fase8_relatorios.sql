-- Sorria FASE 8 — Relatórios e Indicadores
-- Agregações no app/serviço; sem materialized views prematuras.
-- Permissões granulares por seção.

insert into public.permissions (key, label, description, category) values
  ('reports.view_schedule', 'Indicadores de agenda', 'Consultas, faltas, cancelamentos', 'reports'),
  ('reports.view_patients', 'Indicadores de pacientes', 'Novos, origem, retornos administrativos', 'reports'),
  ('reports.view_treatments', 'Indicadores de tratamentos', 'Planos apresentados/aceitos/progresso', 'reports'),
  ('reports.view_financial', 'Indicadores financeiros', 'Recebido, a receber, vencido, despesas', 'reports'),
  ('reports.export', 'Exportar relatórios', 'PDF, XLSX e CSV de relatórios', 'reports')
on conflict (key) do nothing;

-- Owner (admin): todas as seções de relatório
select public.grant_permissions('owner', array[
  'reports.view',
  'reports.view_schedule',
  'reports.view_patients',
  'reports.view_treatments',
  'reports.view_financial',
  'reports.export'
]);

-- Dentist: agenda, pacientes, tratamentos (+ export); sem financeiro de relatório
select public.grant_permissions('dentist', array[
  'reports.view',
  'reports.view_schedule',
  'reports.view_patients',
  'reports.view_treatments',
  'reports.export'
]);

-- Secretary: agenda e pacientes (+ export); sem financeiro/clínico de relatório
select public.grant_permissions('secretary', array[
  'reports.view',
  'reports.view_schedule',
  'reports.view_patients',
  'reports.export'
]);

comment on table public.permissions is
  'Catálogo de permissões. Relatórios: reports.view* — Portal paciente não recebe nenhuma.';
