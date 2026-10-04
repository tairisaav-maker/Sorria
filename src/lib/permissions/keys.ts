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
