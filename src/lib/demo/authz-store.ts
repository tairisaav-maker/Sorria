import {
  CLINICAL_PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  TREATMENT_CLINICAL_PERMISSIONS,
  type MembershipStatus,
  type PermissionKey,
  type RoleKey,
} from "@/lib/permissions/keys";

export type DemoClinic = {
  id: string;
  name: string;
};

export type DemoProfile = {
  id: string;
  full_name: string;
  email: string;
};

export type DemoMembership = {
  id: string;
  clinic_id: string;
  user_id: string;
  role_key: Exclude<RoleKey, "patient">;
  status: MembershipStatus;
  /**
   * Opt-in explícito de acesso clínico (ex.: proprietária que também atende).
   * Owner sem este flag NÃO acessa prontuário.
   */
  clinical_access: boolean;
  invited_at: string | null;
  joined_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoAuditLog = {
  id: string;
  clinic_id: string;
  actor_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Store = {
  clinics: DemoClinic[];
  profiles: DemoProfile[];
  memberships: DemoMembership[];
  auditLogs: DemoAuditLog[];
  /** usuário da sessão demo atual */
  sessionUserId: string;
  sessionClinicId: string;
};

declare global {
  var __sorriaAuthzStore: Store | undefined;
}

export const CLINIC_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const CLINIC_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

export const OWNER_A_ID = "a1000000-0000-0000-0000-000000000001";
export const DENTIST_A_ID = "a1000000-0000-0000-0000-000000000002";
export const SECRETARY_A_ID = "a1000000-0000-0000-0000-000000000003";
export const OWNER_ADMIN_A_ID = "a1000000-0000-0000-0000-000000000099";
export const DENTIST_NO_FINANCE_A_ID = "a1000000-0000-0000-0000-000000000098";
export const OWNER_B_ID = "b1000000-0000-0000-0000-000000000001";
export const DENTIST_B_ID = "b1000000-0000-0000-0000-000000000002";
export const SECRETARY_B_ID = "b1000000-0000-0000-0000-000000000003";

function now() {
  return new Date().toISOString();
}

function seed(): Store {
  const stamp = now();
  const clinics: DemoClinic[] = [
    { id: CLINIC_A_ID, name: "Clínica Demo Sorria" },
    { id: CLINIC_B_ID, name: "Odonto Vida" },
  ];

  const profiles: DemoProfile[] = [
    { id: OWNER_A_ID, full_name: "Dra. Ana Ribeiro", email: "demo@sorria.app" },
    {
      id: DENTIST_A_ID,
      full_name: "Dr. Carlos Menezes",
      email: "carlos.a@clinicademo.sorria.app",
    },
    {
      id: SECRETARY_A_ID,
      full_name: "Mariana Souza",
      email: "mariana.a@clinicademo.sorria.app",
    },
    {
      id: OWNER_B_ID,
      full_name: "Dra. Paula Vieira",
      email: "paula@odontovida.app",
    },
    {
      id: DENTIST_B_ID,
      full_name: "Dr. Renato Alves",
      email: "renato@odontovida.app",
    },
    {
      id: SECRETARY_B_ID,
      full_name: "Fernanda Lopes",
      email: "fernanda@odontovida.app",
    },
  ];

  const memberships: DemoMembership[] = [
    {
      id: "m-a-owner",
      clinic_id: CLINIC_A_ID,
      user_id: OWNER_A_ID,
      role_key: "owner",
      status: "active",
      // Dra. Ana é proprietária E dentista — clínico via opt-in, não via papel owner
      clinical_access: true,
      invited_at: null,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: "m-a-dentist",
      clinic_id: CLINIC_A_ID,
      user_id: DENTIST_A_ID,
      role_key: "dentist",
      status: "active",
      clinical_access: true,
      invited_at: stamp,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: "m-a-secretary",
      clinic_id: CLINIC_A_ID,
      user_id: SECRETARY_A_ID,
      role_key: "secretary",
      status: "active",
      clinical_access: false,
      invited_at: stamp,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: "m-b-owner",
      clinic_id: CLINIC_B_ID,
      user_id: OWNER_B_ID,
      role_key: "owner",
      status: "active",
      clinical_access: true,
      invited_at: null,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: "m-b-dentist",
      clinic_id: CLINIC_B_ID,
      user_id: DENTIST_B_ID,
      role_key: "dentist",
      status: "active",
      clinical_access: true,
      invited_at: stamp,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: "m-b-secretary",
      clinic_id: CLINIC_B_ID,
      user_id: SECRETARY_B_ID,
      role_key: "secretary",
      status: "active",
      clinical_access: false,
      invited_at: stamp,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    },
  ];

  return {
    clinics,
    profiles,
    memberships,
    auditLogs: [],
    sessionUserId: OWNER_A_ID,
    sessionClinicId: CLINIC_A_ID,
  };
}

export function getAuthzStore() {
  if (!globalThis.__sorriaAuthzStore) {
    globalThis.__sorriaAuthzStore = seed();
  }
  return globalThis.__sorriaAuthzStore;
}

export function resetAuthzStore() {
  globalThis.__sorriaAuthzStore = seed();
}

/** Cria owner administrativo sem acesso clínico (teste de arquitetura). */
export function ensureAdminOwnerWithoutClinical() {
  const store = getAuthzStore();
  if (!store.profiles.some((p) => p.id === OWNER_ADMIN_A_ID)) {
    store.profiles.push({
      id: OWNER_ADMIN_A_ID,
      full_name: "Gestor Admin Demo",
      email: "gestor.admin@clinicademo.sorria.app",
    });
  }
  if (!store.memberships.some((m) => m.id === "m-a-owner-admin")) {
    const stamp = now();
    store.memberships.push({
      id: "m-a-owner-admin",
      clinic_id: CLINIC_A_ID,
      user_id: OWNER_ADMIN_A_ID,
      role_key: "owner",
      status: "active",
      clinical_access: false,
      invited_at: null,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  return { userId: OWNER_ADMIN_A_ID, clinicId: CLINIC_A_ID };
}

/** Dentista com clínico, sem qualquer permissão financeira (teste de domínio). */
export function ensureDentistWithoutFinance() {
  const store = getAuthzStore();
  if (!store.profiles.some((p) => p.id === DENTIST_NO_FINANCE_A_ID)) {
    store.profiles.push({
      id: DENTIST_NO_FINANCE_A_ID,
      full_name: "Dra. Sem Financeiro",
      email: "sem.financeiro@clinicademo.sorria.app",
    });
  }
  if (!store.memberships.some((m) => m.id === "m-a-dentist-nofinance")) {
    const stamp = now();
    store.memberships.push({
      id: "m-a-dentist-nofinance",
      clinic_id: CLINIC_A_ID,
      user_id: DENTIST_NO_FINANCE_A_ID,
      role_key: "dentist",
      status: "active",
      clinical_access: true,
      invited_at: null,
      joined_at: stamp,
      suspended_at: null,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  return { userId: DENTIST_NO_FINANCE_A_ID, clinicId: CLINIC_A_ID };
}

export function permissionsForRole(
  role: Exclude<RoleKey, "patient">,
): PermissionKey[] {
  return ROLE_PERMISSION_MATRIX[role];
}

/** Permissões efetivas do membership (owner + clinical_access). */
export function permissionsForMembership(
  membership: DemoMembership,
): PermissionKey[] {
  const base = permissionsForRole(membership.role_key);
  if (membership.role_key === "owner" && membership.clinical_access) {
    return [
      ...new Set([
        ...base,
        ...CLINICAL_PERMISSIONS,
        ...TREATMENT_CLINICAL_PERMISSIONS,
      ]),
    ];
  }
  if (membership.role_key === "dentist") {
    if (membership.user_id === DENTIST_NO_FINANCE_A_ID) {
      return base.filter((p) => !p.startsWith("finance."));
    }
    return base;
  }
  return base;
}

export function getProfile(userId: string) {
  return getAuthzStore().profiles.find((p) => p.id === userId) ?? null;
}

export function getClinic(clinicId: string) {
  return getAuthzStore().clinics.find((c) => c.id === clinicId) ?? null;
}

export function getMembership(userId: string, clinicId: string) {
  return (
    getAuthzStore().memberships.find(
      (m) => m.user_id === userId && m.clinic_id === clinicId,
    ) ?? null
  );
}

export function listClinicMembers(clinicId: string) {
  return getAuthzStore().memberships.filter(
    (m) => m.clinic_id === clinicId && m.status !== "revoked",
  );
}

export function appendAudit(input: Omit<DemoAuditLog, "id" | "created_at">) {
  const entry: DemoAuditLog = {
    id: crypto.randomUUID(),
    created_at: now(),
    ...input,
  };
  getAuthzStore().auditLogs.unshift(entry);
  return entry;
}

export function setDemoSession(userId: string, clinicId: string) {
  const store = getAuthzStore();
  store.sessionUserId = userId;
  store.sessionClinicId = clinicId;
}

export function getDemoSession() {
  const store = getAuthzStore();
  return {
    userId: store.sessionUserId,
    clinicId: store.sessionClinicId,
  };
}

export function countActiveOwners(clinicId: string) {
  return getAuthzStore().memberships.filter(
    (m) =>
      m.clinic_id === clinicId && m.status === "active" && m.role_key === "owner",
  ).length;
}

export function inviteMember(input: {
  clinicId: string;
  actorUserId: string;
  fullName: string;
  email: string;
  roleKey: "dentist" | "secretary";
}) {
  const store = getAuthzStore();
  const email = input.email.trim().toLowerCase();

  let profile = store.profiles.find((p) => p.email.toLowerCase() === email);
  if (!profile) {
    profile = {
      id: crypto.randomUUID(),
      full_name: input.fullName.trim(),
      email,
    };
    store.profiles.push(profile);
  }

  const existing = getMembership(profile.id, input.clinicId);
  if (existing && existing.status !== "revoked") {
    throw new Error("Esta pessoa já possui vínculo com a clínica.");
  }

  const stamp = now();
  const membership: DemoMembership = {
    id: crypto.randomUUID(),
    clinic_id: input.clinicId,
    user_id: profile.id,
    role_key: input.roleKey,
    status: "invited",
    clinical_access: input.roleKey === "dentist",
    invited_at: stamp,
    joined_at: null,
    suspended_at: null,
    created_at: stamp,
    updated_at: stamp,
  };
  store.memberships.push(membership);

  appendAudit({
    clinic_id: input.clinicId,
    actor_user_id: input.actorUserId,
    action: "team.invited",
    target_type: "clinic_member",
    target_id: membership.id,
    metadata: {
      email,
      role: input.roleKey,
      name: profile.full_name,
    },
  });

  return { profile, membership };
}

export function changeRole(input: {
  clinicId: string;
  actorUserId: string;
  membershipId: string;
  newRole: "dentist" | "secretary" | "owner";
}) {
  const store = getAuthzStore();
  const membership = store.memberships.find((m) => m.id === input.membershipId);
  if (!membership || membership.clinic_id !== input.clinicId) {
    throw new Error("Membro não encontrado nesta clínica.");
  }

  const previous = membership.role_key;
  if (previous === "owner" && input.newRole !== "owner") {
    if (countActiveOwners(input.clinicId) <= 1 && membership.status === "active") {
      throw new Error("A clínica não pode ficar sem proprietária ativa.");
    }
  }

  membership.role_key = input.newRole;
  membership.clinical_access = input.newRole === "dentist";
  membership.updated_at = now();

  appendAudit({
    clinic_id: input.clinicId,
    actor_user_id: input.actorUserId,
    action: "team.role_changed",
    target_type: "clinic_member",
    target_id: membership.id,
    metadata: { from: previous, to: input.newRole },
  });

  return membership;
}

export function suspendMember(input: {
  clinicId: string;
  actorUserId: string;
  membershipId: string;
}) {
  const store = getAuthzStore();
  const membership = store.memberships.find((m) => m.id === input.membershipId);
  if (!membership || membership.clinic_id !== input.clinicId) {
    throw new Error("Membro não encontrado nesta clínica.");
  }
  if (membership.user_id === input.actorUserId) {
    throw new Error("Você não pode suspender o próprio acesso.");
  }
  if (
    membership.role_key === "owner" &&
    membership.status === "active" &&
    countActiveOwners(input.clinicId) <= 1
  ) {
    throw new Error("A clínica não pode ficar sem proprietária ativa.");
  }

  membership.status = "suspended";
  membership.suspended_at = now();
  membership.updated_at = now();

  appendAudit({
    clinic_id: input.clinicId,
    actor_user_id: input.actorUserId,
    action: "team.suspended",
    target_type: "clinic_member",
    target_id: membership.id,
    metadata: {},
  });

  return membership;
}

export function reactivateMember(input: {
  clinicId: string;
  actorUserId: string;
  membershipId: string;
}) {
  const store = getAuthzStore();
  const membership = store.memberships.find((m) => m.id === input.membershipId);
  if (!membership || membership.clinic_id !== input.clinicId) {
    throw new Error("Membro não encontrado nesta clínica.");
  }
  if (membership.status !== "suspended" && membership.status !== "invited") {
    throw new Error("Somente convites ou suspensos podem ser reativados.");
  }

  membership.status = "active";
  membership.joined_at = membership.joined_at ?? now();
  membership.suspended_at = null;
  membership.updated_at = now();

  appendAudit({
    clinic_id: input.clinicId,
    actor_user_id: input.actorUserId,
    action:
      membership.invited_at && !membership.joined_at
        ? "team.invite_accepted"
        : "team.reactivated",
    target_type: "clinic_member",
    target_id: membership.id,
    metadata: {},
  });

  return membership;
}
