/** Permissões do Sorria — ações, não telas. */
export const PERMISSIONS = [
  "dashboard.view",

  "appointments.view",
  "appointments.create",
  "appointments.update",
  "appointments.cancel",
  "appointment_requests.view",
  "appointment_requests.manage",

  "patients.demographics.view",
  "patients.demographics.create",
  "patients.demographics.update",
  "patients.contact.view",
  "patients.contact.update",
  "patients.administrative.view",
  "patients.administrative.update",

  "clinical_record.view",
  "clinical_record.create",
  "clinical_record.update",
  "anamnesis.view",
  "anamnesis.create",
  "anamnesis.update",
  "clinical_evolution.view",
  "clinical_evolution.create",
  "clinical_evolution.update",
  "odontogram.view",
  "odontogram.update",
  "clinical_files.view",
  "clinical_files.upload",

  "treatments.administrative_view",
  "treatments.view",
  "treatments.create",
  "treatments.update",
  "treatments.present",
  "treatments.acceptance_manage",
  "treatments.progress_update",

  "finance.view_administrative",
  "finance.view_authorized",
  "finance.transaction_create",
  "finance.transaction_update",
  "finance.payment_create",
  "finance.payment_reverse",
  "finance.expense_create",
  "finance.export",

  "reports.view",
  "reports.view_schedule",
  "reports.view_patients",
  "reports.view_treatments",
  "reports.view_financial",
  "reports.procedure_costs_view",
  "reports.materials_view",
  "reports.patient_financial_view",
  "reports.financial_view",
  "reports.export",

  "assistant.use",

  "clinic.settings",

  "procedures.view",
  "procedures.create",
  "procedures.update",
  "procedure_costs.view",
  "procedure_costs.update",
  "procedure_consumption.view",
  "procedure_consumption.update",
  "procedure_consumption.confirm",
  "procedure_consumption.correct",

  "performed_procedures.view",
  "performed_procedures.create",
  "performed_procedures.update",
  "performed_procedures.complete",

  "appointment_planned_procedures.view",
  "appointment_planned_procedures.create",
  "appointment_planned_procedures.update",

  "inventory.view",
  "inventory.create",
  "inventory.update",
  "inventory.adjust",
  "inventory.purchase_create",
  "inventory.movements_view",
  "inventory.cost_view",
  "inventory.forecast_view",
  "inventory.forecast_cost_view",
  "inventory.replenishment_view",
  "inventory.purchase_list_create",
  "inventory.purchase_list_update",

  "clinic_costs.view",
  "clinic_costs.manage",
  "operational_costs.view",
  "procedure_operational_costs.view",
  "expense_categories.manage",

  "cost_reports.view",

  "procedure_pricing.view",
  "procedure_pricing.manage",
  "procedures.update_price",
  "reports.pricing_view",

  "team.view",
  "team.invite",
  "team.change_role",
  "team.suspend",
  "team.reactivate",
  "permissions.manage",

  "audit.view",
  "audit.view_sensitive",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = ["owner", "dentist", "secretary", "patient"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const MEMBERSHIP_STATUSES = [
  "invited",
  "active",
  "suspended",
  "revoked",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CLINICAL_PERMISSIONS: PermissionKey[] = [
  "clinical_record.view",
  "clinical_record.create",
  "clinical_record.update",
  "anamnesis.view",
  "anamnesis.create",
  "anamnesis.update",
  "clinical_evolution.view",
  "clinical_evolution.create",
  "clinical_evolution.update",
  "odontogram.view",
  "odontogram.update",
  "clinical_files.view",
  "clinical_files.upload",
];

export const PATIENT_ADMIN_PERMISSIONS: PermissionKey[] = [
  "patients.demographics.view",
  "patients.demographics.create",
  "patients.demographics.update",
  "patients.contact.view",
  "patients.contact.update",
  "patients.administrative.view",
  "patients.administrative.update",
];

/**
 * Owner = poder administrativo da clínica.
 * NÃO implica acesso clínico universal (gestor ≠ profissional clínico).
 * Acesso clínico exige papel dentist ou membership.clinical_access.
 */
/** Tratamento clínico (elaboração/execução) — separado do administrativo. */
export const TREATMENT_CLINICAL_PERMISSIONS: PermissionKey[] = [
  "treatments.view",
  "treatments.create",
  "treatments.update",
  "treatments.present",
  "treatments.acceptance_manage",
  "treatments.progress_update",
];

export const OWNER_ADMIN_PERMISSIONS: PermissionKey[] = PERMISSIONS.filter(
  (key) =>
    !CLINICAL_PERMISSIONS.includes(key) &&
    !TREATMENT_CLINICAL_PERMISSIONS.includes(key),
);

export const ROLE_PERMISSION_MATRIX: Record<
  Exclude<RoleKey, "patient">,
  PermissionKey[]
> = {
  owner: [...OWNER_ADMIN_PERMISSIONS],
  dentist: [
    "dashboard.view",
    "appointments.view",
    "appointments.create",
    "appointments.update",
    "appointment_requests.view",
    "appointment_requests.manage",
    "patients.demographics.view",
    "patients.demographics.create",
    "patients.demographics.update",
    "patients.contact.view",
    "patients.administrative.view",
    ...CLINICAL_PERMISSIONS,
    ...TREATMENT_CLINICAL_PERMISSIONS,
    "finance.view_authorized",
    "reports.view",
    "reports.view_schedule",
    "reports.view_patients",
    "reports.view_treatments",
    "reports.procedure_costs_view",
    "reports.materials_view",
    "reports.export",
    "assistant.use",
    "procedures.view",
    "procedures.create",
    "procedures.update",
    "procedure_costs.view",
    "procedure_consumption.view",
    "procedure_consumption.update",
    "procedure_consumption.confirm",
    "procedure_consumption.correct",
    "performed_procedures.view",
    "performed_procedures.create",
    "performed_procedures.update",
    "performed_procedures.complete",
    "appointment_planned_procedures.view",
    "appointment_planned_procedures.create",
    "appointment_planned_procedures.update",
    "inventory.view",
    "inventory.movements_view",
    "inventory.forecast_view",
    "inventory.forecast_cost_view",
    "inventory.replenishment_view",
    "procedure_operational_costs.view",
    "cost_reports.view",
    "procedure_pricing.view",
    "reports.pricing_view",
  ],
  secretary: [
    "dashboard.view",
    "appointments.view",
    "appointments.create",
    "appointments.update",
    "appointments.cancel",
    "appointment_requests.view",
    "appointment_requests.manage",
    ...PATIENT_ADMIN_PERMISSIONS,
    "treatments.administrative_view",
    "treatments.present",
    "treatments.acceptance_manage",
    "finance.view_administrative",
    "finance.transaction_create",
    "finance.expense_create",
    "finance.payment_create",
    "finance.payment_reverse",
    "finance.export",
    "reports.view",
    "reports.view_schedule",
    "reports.view_patients",
    "reports.view_financial",
    "reports.materials_view",
    "reports.patient_financial_view",
    "reports.financial_view",
    "reports.export",
    "assistant.use",
    "procedures.view",
    "performed_procedures.view",
    "appointment_planned_procedures.view",
    "appointment_planned_procedures.create",
    "appointment_planned_procedures.update",
    "inventory.view",
    "inventory.create",
    "inventory.update",
    "inventory.adjust",
    "inventory.purchase_create",
    "inventory.movements_view",
    "inventory.cost_view",
    "inventory.forecast_view",
    "inventory.replenishment_view",
    "inventory.purchase_list_create",
    "inventory.purchase_list_update",
    "expense_categories.manage",
  ],
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  owner: "Proprietária",
  dentist: "Dentista",
  secretary: "Secretária",
  patient: "Paciente",
};

export const STATUS_LABELS: Record<MembershipStatus, string> = {
  invited: "Convite pendente",
  active: "Ativo",
  suspended: "Suspenso",
  revoked: "Revogado",
};
