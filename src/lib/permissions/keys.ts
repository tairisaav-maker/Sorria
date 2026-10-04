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

  "finance.view_administrative",
  "finance.payment_create",
  "finance.view_authorized",

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

export const ROLE_PERMISSION_MATRIX: Record<
  Exclude<RoleKey, "patient">,
  PermissionKey[]
> = {
  owner: [...PERMISSIONS],
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
    "treatments.view",
    "treatments.create",
    "treatments.update",
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
    "finance.view_administrative",
    "finance.payment_create",
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
