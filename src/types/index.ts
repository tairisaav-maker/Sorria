export type { Clinic, ClinicMember, ClinicRole, Database, Profile } from "./database";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "calendar" | "users" | "wallet" | "more";
  enabled: boolean;
};
