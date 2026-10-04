export type ClinicRole = "owner" | "dentist" | "secretary" | "staff";

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

export type ClinicMember = {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicRole;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
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
      clinic_members: {
        Row: ClinicMember;
        Insert: Partial<ClinicMember> &
          Pick<ClinicMember, "clinic_id" | "user_id" | "role">;
        Update: Partial<ClinicMember>;
      };
    };
    Enums: {
      clinic_role: ClinicRole;
    };
  };
};
