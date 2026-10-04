import type {
  MembershipStatus,
  PermissionKey,
  RoleKey,
} from "@/lib/permissions/keys";

export type Clinic = {
  id: string;
  name: string;
  slug: string | null;
  timezone: string;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Role = {
  id: string;
  key: RoleKey;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

export type Permission = {
  id: string;
  key: PermissionKey;
  name: string;
  description: string | null;
  category: string;
  created_at: string;
};

export type RolePermission = {
  role_id: string;
  permission_id: string;
  created_at: string;
};

export type ClinicMember = {
  id: string;
  clinic_id: string;
  user_id: string;
  role_id: string;
  status: MembershipStatus;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  clinic_id: string | null;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: Clinic;
        Insert: Partial<Clinic> & Pick<Clinic, "name">;
        Update: Partial<Clinic>;
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id">;
        Update: Partial<Profile>;
      };
      roles: {
        Row: Role;
        Insert: Partial<Role> & Pick<Role, "key" | "name">;
        Update: Partial<Role>;
      };
      permissions: {
        Row: Permission;
        Insert: Partial<Permission> &
          Pick<Permission, "key" | "name" | "category">;
        Update: Partial<Permission>;
      };
      role_permissions: {
        Row: RolePermission;
        Insert: RolePermission;
        Update: Partial<RolePermission>;
      };
      clinic_members: {
        Row: ClinicMember;
        Insert: Partial<ClinicMember> &
          Pick<ClinicMember, "clinic_id" | "user_id" | "role_id">;
        Update: Partial<ClinicMember>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & Pick<AuditLog, "action">;
        Update: never;
      };
    };
    Enums: {
      membership_status: MembershipStatus;
    };
  };
};

/** @deprecated use RoleKey via membership.role_id */
export type ClinicRole = RoleKey;
