import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  attemptForbiddenEscalation,
  changeMemberRole,
  invitePerson,
  suspendTeamMember,
} from "@/lib/authz/team-service";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  OWNER_B_ID,
  SECRETARY_A_ID,
  SECRETARY_B_ID,
  getMembership,
  permissionsForRole,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import {
  CLINICAL_PERMISSIONS,
  PATIENT_ADMIN_PERMISSIONS,
} from "@/lib/permissions/keys";

beforeEach(() => {
  resetAuthzStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("matriz de papéis", () => {
  it("secretary tem permissões administrativas de paciente", () => {
    for (const permission of PATIENT_ADMIN_PERMISSIONS) {
      expect(permissionsForRole("secretary")).toContain(permission);
    }
  });

  it("secretary NÃO tem permissões clínicas", () => {
    for (const permission of CLINICAL_PERMISSIONS) {
      expect(permissionsForRole("secretary")).not.toContain(permission);
    }
  });

  it("dentist tem permissões clínicas", () => {
    expect(permissionsForRole("dentist")).toContain("clinical_record.view");
    expect(permissionsForRole("dentist")).toContain("anamnesis.view");
    expect(permissionsForRole("dentist")).toContain("odontogram.view");
  });
});

describe("cross-clinic", () => {
  it("Owner A acessa Clinic A", () => {
    expect(
      can({ userId: OWNER_A_ID, clinicId: CLINIC_A_ID }, "team.view", CLINIC_A_ID)
        .allowed,
    ).toBe(true);
  });

  it("Owner A NÃO acessa Clinic B", () => {
    expect(
      can({ userId: OWNER_A_ID, clinicId: CLINIC_A_ID }, "team.view", CLINIC_B_ID)
        .allowed,
    ).toBe(false);
    expect(
      can({ userId: OWNER_A_ID, clinicId: CLINIC_B_ID }, "team.view").reason,
    ).toBe("no_membership");
  });

  it("Dentist A e Secretary A não acessam Clinic B", () => {
    expect(
      can({ userId: DENTIST_A_ID, clinicId: CLINIC_B_ID }, "dashboard.view")
        .allowed,
    ).toBe(false);
    expect(
      can({ userId: SECRETARY_A_ID, clinicId: CLINIC_B_ID }, "dashboard.view")
        .allowed,
    ).toBe(false);
  });

  it("clinic_id forjado é negado", () => {
    expect(() =>
      attemptForbiddenEscalation(
        { userId: OWNER_A_ID, clinicId: CLINIC_A_ID },
        "m-a-secretary",
        CLINIC_B_ID,
      ),
    ).toThrow(/negada entre clínicas/i);
  });
});

describe("administrativo × clínico (obrigatório)", () => {
  const secretaryCtx = {
    userId: SECRETARY_A_ID,
    clinicId: CLINIC_A_ID,
  };

  it("Secretary A pode ver dados administrativos do paciente", () => {
    expect(can(secretaryCtx, "patients.demographics.view").allowed).toBe(true);
    expect(can(secretaryCtx, "patients.contact.view").allowed).toBe(true);
    expect(can(secretaryCtx, "patients.administrative.view").allowed).toBe(
      true,
    );
  });

  it("Secretary A NÃO pode ver domínio clínico", () => {
    expect(can(secretaryCtx, "clinical_record.view").allowed).toBe(false);
    expect(can(secretaryCtx, "anamnesis.view").allowed).toBe(false);
    expect(can(secretaryCtx, "clinical_evolution.view").allowed).toBe(false);
    expect(can(secretaryCtx, "odontogram.view").allowed).toBe(false);
    expect(can(secretaryCtx, "clinical_files.view").allowed).toBe(false);
  });
});

describe("escalonamento e suspensão", () => {
  it("secretária não gerencia equipe", () => {
    expect(
      can(
        { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID },
        "team.change_role",
      ).allowed,
    ).toBe(false);
    expect(
      can(
        { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID },
        "permissions.manage",
      ).allowed,
    ).toBe(false);
  });

  it("dentist não altera papéis", () => {
    expect(
      can({ userId: DENTIST_A_ID, clinicId: CLINIC_A_ID }, "team.change_role")
        .allowed,
    ).toBe(false);
  });

  it("suspender secretária bloqueia acesso", () => {
    suspendTeamMember(
      { userId: OWNER_A_ID, clinicId: CLINIC_A_ID },
      "m-a-secretary",
    );
    const membership = getMembership(SECRETARY_A_ID, CLINIC_A_ID);
    expect(membership?.status).toBe("suspended");
    expect(
      can(
        { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID },
        "dashboard.view",
      ).allowed,
    ).toBe(false);
  });

  it("não permite clínica sem owner", () => {
    expect(() =>
      changeMemberRole(
        { userId: OWNER_A_ID, clinicId: CLINIC_A_ID },
        { membershipId: "m-a-owner", newRole: "secretary" },
      ),
    ).toThrow();
  });

  it("owner convida dentista/secretária", () => {
    const result = invitePerson(
      { userId: OWNER_A_ID, clinicId: CLINIC_A_ID },
      {
        fullName: "Nova Pessoa",
        email: "nova@clinicademo.sorria.app",
        roleKey: "secretary",
      },
    );
    expect(result.membership.status).toBe("invited");
    expect(result.membership.role_key).toBe("secretary");
  });

  it("Dentist → Secretária remove acesso clínico", () => {
    changeMemberRole(
      { userId: OWNER_A_ID, clinicId: CLINIC_A_ID },
      { membershipId: "m-a-dentist", newRole: "secretary" },
    );
    expect(
      can({ userId: DENTIST_A_ID, clinicId: CLINIC_A_ID }, "clinical_record.view")
        .allowed,
    ).toBe(false);
    expect(
      can(
        { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID },
        "patients.demographics.view",
      ).allowed,
    ).toBe(true);
  });
});

describe("isolamento Clinic B", () => {
  it("Owner B não opera em Clinic A", () => {
    expect(
      can({ userId: OWNER_B_ID, clinicId: CLINIC_A_ID }, "team.view").allowed,
    ).toBe(false);
    expect(
      can({ userId: SECRETARY_B_ID, clinicId: CLINIC_A_ID }, "dashboard.view")
        .allowed,
    ).toBe(false);
  });
});
