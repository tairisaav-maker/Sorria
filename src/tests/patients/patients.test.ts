import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
  suspendMember,
} from "@/lib/demo/authz-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import {
  isValidCpf,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
} from "@/lib/patients/normalize";
import { isMinor } from "@/lib/patients/age";
import {
  archivePatient,
  checkPotentialDuplicates,
  createPatient,
  getPatient,
  listPatients,
  reactivatePatient,
  updatePatient,
} from "@/services/patients";
import { CLINICAL_PERMISSIONS } from "@/lib/permissions/keys";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };

beforeEach(() => {
  resetAuthzStore();
  resetPatientsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("normalização", () => {
  it("normaliza CPF, telefone e e-mail", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(normalizePhone("(31) 99999-4821")).toBe("31999994821");
    expect(normalizeEmail("  Ana@Email.COM ")).toBe("ana@email.com");
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
});

describe("cadastro", () => {
  it("permite somente nome", () => {
    const result = createPatient(ownerA, {
      full_name: "Paciente Mínimo",
      status: "active",
      acknowledge_duplicate: false,
    } as never);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patient.phone).toBeNull();
      expect(result.patient.cpf).toBeNull();
    }
  });

  it("aceita nome + telefone e rejeita CPF inválido", () => {
    const ok = createPatient(ownerA, {
      full_name: "Com Telefone",
      phone: "(11) 98888-7777",
      status: "active",
      acknowledge_duplicate: false,
    } as never);
    expect(ok.ok).toBe(true);

    expect(() =>
      createPatient(ownerA, {
        full_name: "CPF Ruim",
        cpf: "123.456.789-00",
        status: "active",
        acknowledge_duplicate: false,
      } as never),
    ).toThrow(/CPF/i);
  });

  it("detecta menor de idade", () => {
    expect(isMinor("2015-01-01")).toBe(true);
    expect(isMinor("1990-01-01")).toBe(false);
  });
});

describe("duplicidade", () => {
  it("CPF idêntico na mesma clínica", () => {
    const dups = checkPotentialDuplicates({
      clinicId: CLINIC_A_ID,
      cpf: "529.982.247-25",
    });
    expect(dups[0]?.severity).toBe("high");
    expect(dups[0]?.patient.full_name).toBe("Mariana Oliveira");
  });

  it("telefone e e-mail idênticos", () => {
    expect(
      checkPotentialDuplicates({
        clinicId: CLINIC_A_ID,
        phone: "31999994821",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      checkPotentialDuplicates({
        clinicId: CLINIC_A_ID,
        email: "mariana.oliveira@email.com",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("nome + nascimento", () => {
    const dups = checkPotentialDuplicates({
      clinicId: CLINIC_A_ID,
      full_name: "Mariana Oliveira",
      birth_date: "1992-03-14",
    });
    expect(dups.some((d) => d.reasons.includes("name_birth"))).toBe(true);
  });

  it("apenas nome semelhante não bloqueia", () => {
    const dups = checkPotentialDuplicates({
      clinicId: CLINIC_A_ID,
      full_name: "Mariana Oliveira Silva",
    });
    expect(dups).toHaveLength(0);
  });

  it("nunca revela duplicidade de outra clínica", () => {
    // Clinic B has same CPF; search from A must only see A
    const dups = checkPotentialDuplicates({
      clinicId: CLINIC_A_ID,
      cpf: "52998224725",
    });
    expect(dups.every((d) => d.patient.clinic_id === CLINIC_A_ID)).toBe(true);
    expect(dups.some((d) => d.patient.id === "p-b-001")).toBe(false);
  });
});

describe("busca e listagem", () => {
  it("busca por nome parcial, telefone e CPF com/sem máscara", () => {
    expect(listPatients(ownerA, { query: "Mari" }).items.length).toBeGreaterThan(
      0,
    );
    expect(
      listPatients(ownerA, { query: "(31) 99999-4821" }).items.some(
        (p) => p.id === "p-a-001",
      ),
    ).toBe(true);
    expect(
      listPatients(ownerA, { query: "31999994821" }).items.some(
        (p) => p.id === "p-a-001",
      ),
    ).toBe(true);
    expect(
      listPatients(ownerA, { query: "529.982.247-25" }).items.some(
        (p) => p.id === "p-a-001",
      ),
    ).toBe(true);
    expect(
      listPatients(ownerA, { query: "52998224725" }).items.some(
        (p) => p.id === "p-a-001",
      ),
    ).toBe(true);
    expect(
      listPatients(ownerA, { query: "mariana.oliveira@email.com" }).items.some(
        (p) => p.id === "p-a-001",
      ),
    ).toBe(true);
  });

  it("filtra status e pagina", () => {
    const active = listPatients(ownerA, { status: "active" });
    expect(active.items.every((p) => p.status === "active")).toBe(true);
    const archived = listPatients(ownerA, { status: "archived" });
    expect(archived.items.some((p) => p.id === "p-a-007")).toBe(true);
    const page = listPatients(ownerA, { page: 1, pageSize: 3 });
    expect(page.items.length).toBeLessThanOrEqual(3);
  });
});

describe("status arquivamento", () => {
  it("arquiva e reativa preservando histórico", () => {
    const archived = archivePatient(ownerA, "p-a-003");
    expect(archived.status).toBe("archived");
    expect(archived.archived_at).toBeTruthy();
    const reactivated = reactivatePatient(ownerA, "p-a-003");
    expect(reactivated.status).toBe("active");
    expect(reactivated.archived_at).toBeNull();
  });

  it("update altera status inactive", () => {
    const patient = updatePatient(ownerA, "p-a-003", {
      full_name: "Pedro Almeida",
      status: "inactive",
      acknowledge_duplicate: false,
    } as never);
    expect(patient.status).toBe("inactive");
  });
});

describe("permissões e cross-clinic", () => {
  it("Owner/Dentist/Secretary A acessam Clinic A", () => {
    expect(getPatient(ownerA, "p-a-001").id).toBe("p-a-001");
    expect(getPatient(dentistA, "p-a-001").id).toBe("p-a-001");
    expect(getPatient(secretaryA, "p-a-001").id).toBe("p-a-001");
  });

  it("nega acesso a paciente da Clinic B", () => {
    expect(() => getPatient(ownerA, "p-b-001")).toThrow("PATIENT_NOT_FOUND");
    expect(() => getPatient(dentistA, "p-b-001")).toThrow("PATIENT_NOT_FOUND");
    expect(() => getPatient(secretaryA, "p-b-001")).toThrow("PATIENT_NOT_FOUND");
  });

  it("nega clinic_id forjado no create", () => {
    expect(() =>
      createPatient(ownerA, {
        full_name: "Ataque",
        clinic_id: CLINIC_B_ID,
        status: "active",
        acknowledge_duplicate: false,
      } as never),
    ).toThrow("AUTHORIZATION_DENIED");
  });

  it("usuário suspenso não consulta", () => {
    suspendMember({
      clinicId: CLINIC_A_ID,
      actorUserId: OWNER_A_ID,
      membershipId: "m-a-secretary",
    });
    expect(
      can(secretaryA, "patients.demographics.view").allowed,
    ).toBe(false);
    expect(() => getPatient(secretaryA, "p-a-001")).toThrow(
      "AUTHORIZATION_DENIED",
    );
  });

  it("admin × clínico: secretária sem permissões clínicas", () => {
    expect(can(secretaryA, "patients.demographics.view").allowed).toBe(true);
    expect(can(secretaryA, "patients.contact.view").allowed).toBe(true);
    expect(can(secretaryA, "patients.administrative.view").allowed).toBe(true);
    for (const permission of CLINICAL_PERMISSIONS) {
      expect(can(secretaryA, permission).allowed).toBe(false);
    }
  });
});
