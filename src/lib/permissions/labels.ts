import type { PermissionKey } from "@/lib/permissions/keys";

export type AccessGroup = {
  title: string;
  items: Array<{ key: PermissionKey; label: string }>;
};

/** Tradução humana das permissões para a tela "Acesso de ...". */
export const ACCESS_GROUPS: AccessGroup[] = [
  {
    title: "Agenda",
    items: [
      { key: "appointments.view", label: "Visualizar" },
      { key: "appointments.create", label: "Criar" },
      { key: "appointments.update", label: "Reagendar" },
      { key: "appointments.cancel", label: "Cancelar" },
      { key: "appointment_requests.view", label: "Ver solicitações" },
      { key: "appointment_requests.manage", label: "Gerenciar solicitações" },
    ],
  },
  {
    title: "Pacientes",
    items: [
      { key: "patients.demographics.view", label: "Dados cadastrais" },
      { key: "patients.contact.view", label: "Contato" },
      { key: "patients.administrative.view", label: "Dados administrativos" },
    ],
  },
  {
    title: "Prontuário",
    items: [
      { key: "anamnesis.view", label: "Anamnese clínica" },
      { key: "clinical_evolution.view", label: "Evoluções" },
      { key: "odontogram.view", label: "Odontograma" },
      { key: "clinical_files.view", label: "Arquivos clínicos" },
      { key: "clinical_record.view", label: "Prontuário clínico" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { key: "finance.view_administrative", label: "Administrativo" },
      { key: "finance.view_authorized", label: "Autorizado ao profissional" },
      { key: "finance.transaction_create", label: "Criar lançamentos" },
      { key: "finance.transaction_update", label: "Atualizar/cancelar lançamentos" },
      { key: "finance.payment_create", label: "Registrar pagamento" },
      { key: "finance.payment_reverse", label: "Estornar pagamento" },
      { key: "finance.expense_create", label: "Registrar despesa" },
      { key: "finance.export", label: "Exportar" },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { key: "reports.view", label: "Acessar relatórios" },
      { key: "reports.view_schedule", label: "Indicadores de agenda" },
      { key: "reports.view_patients", label: "Indicadores de pacientes" },
      { key: "reports.view_treatments", label: "Indicadores de tratamentos" },
      { key: "reports.view_financial", label: "Indicadores financeiros" },
      { key: "reports.export", label: "Exportar relatórios" },
    ],
  },
  {
    title: "Equipe",
    items: [
      { key: "team.view", label: "Ver equipe" },
      { key: "team.invite", label: "Convidar pessoas" },
      { key: "team.change_role", label: "Alterar funções" },
      { key: "permissions.manage", label: "Gerenciar usuários/permissões" },
    ],
  },
];
