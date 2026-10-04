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
      { key: "appointment_planned_procedures.view", label: "Ver procedimentos previstos" },
      { key: "appointment_planned_procedures.create", label: "Adicionar procedimento previsto" },
      { key: "appointment_planned_procedures.update", label: "Editar procedimento previsto" },
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
      { key: "clinic_costs.view", label: "Ver custos do consultório" },
      { key: "clinic_costs.manage", label: "Configurar custos / horas produtivas" },
      { key: "operational_costs.view", label: "Ver custo/hora operacional" },
      { key: "procedure_operational_costs.view", label: "Ver custo operacional do procedimento" },
      { key: "expense_categories.manage", label: "Gerenciar categorias de despesa" },
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
      { key: "reports.procedure_costs_view", label: "Custos e rentabilidade operacional" },
      { key: "reports.materials_view", label: "Consumo de materiais" },
      { key: "reports.patient_financial_view", label: "Financeiro por paciente (relatórios)" },
      { key: "reports.financial_view", label: "Relatório financeiro operacional" },
      { key: "reports.export", label: "Exportar relatórios" },
    ],
  },
  {
    title: "Procedimentos e custos",
    items: [
      { key: "procedures.view", label: "Ver procedimentos" },
      { key: "procedures.create", label: "Criar procedimentos" },
      { key: "procedures.update", label: "Editar procedimentos" },
      { key: "procedure_costs.view", label: "Ver custos de procedimento" },
      { key: "procedure_costs.update", label: "Editar ficha técnica / custos" },
      { key: "procedure_consumption.view", label: "Ver consumo" },
      { key: "procedure_consumption.update", label: "Editar consumo" },
      { key: "procedure_consumption.confirm", label: "Confirmar consumo" },
      { key: "procedure_consumption.correct", label: "Corrigir consumo" },
      { key: "performed_procedures.view", label: "Ver procedimentos do paciente" },
      { key: "performed_procedures.create", label: "Registrar procedimento" },
      { key: "performed_procedures.update", label: "Editar procedimento realizado" },
      { key: "performed_procedures.complete", label: "Concluir procedimento" },
      { key: "cost_reports.view", label: "Relatórios de custo" },
    ],
  },
  {
    title: "Estoque",
    items: [
      { key: "inventory.view", label: "Ver estoque" },
      { key: "inventory.create", label: "Criar itens" },
      { key: "inventory.update", label: "Editar itens" },
      { key: "inventory.adjust", label: "Ajustar estoque" },
      { key: "inventory.purchase_create", label: "Registrar compras" },
      { key: "inventory.movements_view", label: "Ver movimentações" },
      { key: "inventory.cost_view", label: "Ver custos de estoque" },
      { key: "inventory.forecast_view", label: "Ver previsão de materiais" },
      { key: "inventory.forecast_cost_view", label: "Ver custo estimado da previsão" },
      { key: "inventory.replenishment_view", label: "Ver reposição inteligente" },
      { key: "inventory.purchase_list_create", label: "Criar lista de compras" },
      { key: "inventory.purchase_list_update", label: "Editar lista de compras" },
    ],
  },
  {
    title: "Secretária Virtual",
    items: [
      { key: "assistant.use", label: "Usar Secretária Virtual" },
    ],
  },
  {
    title: "Clínica",
    items: [
      { key: "clinic.settings", label: "Configurar clínica e horários" },
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
