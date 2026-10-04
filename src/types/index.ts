export type {
  AuditLog,
  Clinic,
  ClinicMember,
  ClinicRole,
  Database,
  Permission,
  Profile,
  Role,
  RolePermission,
} from "./database";

export type {
  DuplicateMatch,
  Patient,
  PatientListItem,
  PatientStatus,
  ReferralSource,
} from "./patient";

export type NavItem = {
  href: string;
  label: string;
  icon:
    | "home"
    | "calendar"
    | "users"
    | "wallet"
    | "package"
    | "procedure"
    | "assistant"
    | "more";
  enabled: boolean;
};
