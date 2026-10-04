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

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "calendar" | "users" | "wallet" | "more";
  enabled: boolean;
};
