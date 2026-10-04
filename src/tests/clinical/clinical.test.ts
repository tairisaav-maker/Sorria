import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  ensureAdminOwnerWithoutClinical,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetAgendaStore } from "@/lib/demo/agenda-store";
import { resetClinicalStore, getClinicalStore } from "@/lib/demo/clinical-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import {
  getAnamnesis,
  reviewAnamnesis,
  saveAnamnesisDraft,
  submitAnamnesis,
} from "@/services/anamnesis";
import {
  addClinicalEntryCorrection,
  countPendingFollowUps,
  createClinicalEntry,
  finalizeClinicalEntry,
  getClinicalEntryVersions,
  getClinicalSummary,
  getPatientFollowUp,
  listClinicalEntries,
  updateClinicalEntryDraft,
} from "@/services/clinical";
import { getOdontogram, updateTooth } from "@/services/odontogram";
import {
  getClinicalAttachmentAccess,
  tryAccessByStoragePath,
  uploadClinicalAttachment,
} from "@/services/attachments";
import { CLINICAL_PERMISSIONS } from "@/lib/permissions/keys";
import { permissionsForRole } from "@/lib/demo/authz-store";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };

beforeEach(() => {
  resetAuthzStore();
  resetPatientsStore();
  resetAgendaStore();
  resetClinicalStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("owner administrativo ≠ clínico", () => {
  it("papel owner sozinho não inclui permissões clínicas", () => {
    for (const permission of CLINICAL_PERMISSIONS) {
      expect(permissionsForRole("owner")).not.toContain(permission);
    }
  });

  it("owner com clinical_access (Ana) acessa prontuário", () => {
    expect(can(ownerA, "clinical_record.view").allowed).toBe(true);
  });

  it("owner administrativo sem clinical_access é negado", () => {
    const admin = ensureAdminOwnerWithoutClinical();
    expect(can(admin, "team.view").allowed).toBe(true);
    expect(can(admin, "clinical_record.view").allowed).toBe(false);
    expect(can(admin, "anamnesis.view").allowed).toBe(false);
    expect(() => getClinicalSummary(admin, "p-a-001")).toThrow(
      "AUTHORIZATION_DENIED",
    );
  });
});

describe("secretária sem clínico", () => {
  it("nega anamnese, evolução, odontograma e arquivos", () => {
    expect(can(secretaryA, "patients.demographics.view").allowed).toBe(true);
    expect(can(secretaryA, "appointments.view").allowed).toBe(true);
    expect(can(secretaryA, "anamnesis.view").allowed).toBe(false);
    expect(can(secretaryA, "clinical_evolution.view").allowed).toBe(false);
    expect(can(secretaryA, "odontogram.view").allowed).toBe(false);
    expect(can(secretaryA, "clinical_files.view").allowed).toBe(false);
    expect(() => getAnamnesis(secretaryA, "p-a-001")).toThrow(
      "AUTHORIZATION_DENIED",
    );
    expect(() => listClinicalEntries(secretaryA, "p-a-001")).toThrow(
      "AUTHORIZATION_DENIED",
    );
  });
});

describe("anamnese", () => {
  it("draft → submitted → reviewed", () => {
    saveAnamnesisDraft(dentistA, "p-a-003", {
      has_allergy: { value_bool: true },
      allergy_detail: { value_text: "Látex (fictício)" },
    });
    let result = getAnamnesis(dentistA, "p-a-003");
    expect(result.anamnesis?.status).toBe("draft");

    result = submitAnamnesis(dentistA, "p-a-003");
    expect(result.anamnesis?.status).toBe("submitted");

    result = reviewAnamnesis(dentistA, "p-a-003");
    expect(result.anamnesis?.status).toBe("reviewed");
    expect(result.anamnesis?.reviewed_by).toBe(DENTIST_A_ID);
  });

  it("campo condicional de alergia gera alerta no resumo", () => {
    const summary = getClinicalSummary(ownerA, "p-a-001");
    expect(summary.alerts.some((a) => a.label.includes("Alergia"))).toBe(true);
  });
});

describe("evolução e versionamento", () => {
  it("cria rascunho, edita, finaliza e corrige preservando versões", () => {
    const created = createClinicalEntry(dentistA, {
      patient_id: "p-a-003",
      chief_complaint: "Dor",
      clinical_exam: "Exame inicial",
    });
    expect(created.status).toBe("draft");

    const updated = updateClinicalEntryDraft(dentistA, created.id, {
      patient_id: "p-a-003",
      chief_complaint: "Dor no 26",
      clinical_exam: "Cárie",
      expected_updated_at: created.updated_at,
    });
    expect(updated.chief_complaint).toBe("Dor no 26");

    const finalized = finalizeClinicalEntry(dentistA, {
      id: created.id,
      expected_updated_at: updated.updated_at,
    });
    expect(finalized.status).toBe("finalized");
    expect(finalized.signed_at).toBeTruthy();

    expect(() =>
      updateClinicalEntryDraft(dentistA, created.id, {
        patient_id: "p-a-003",
        chief_complaint: "hack",
      }),
    ).toThrow(/sobrescrito/);

    const v1 = getClinicalStore().versions.find(
      (v) => v.clinical_entry_id === created.id && v.version_number === 1,
    );
    expect(v1?.snapshot_json.chief_complaint).toBe("Dor no 26");

    const corrected = addClinicalEntryCorrection(dentistA, {
      id: created.id,
      change_reason: "Complemento do exame",
      chief_complaint: "Dor no 26 — atualizado",
      clinical_exam: "Cárie profunda",
      expected_updated_at: finalized.updated_at,
    });
    expect(corrected.version_number).toBe(2);

    const versions = getClinicalEntryVersions(dentistA, created.id);
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(
      getClinicalStore().versions.find(
        (v) => v.clinical_entry_id === created.id && v.version_number === 1,
      )?.snapshot_json.chief_complaint,
    ).toBe("Dor no 26");
    expect(versions[0]?.change_reason).toBe("Complemento do exame");
  });

  it("concorrência otimista nega update desatualizado", () => {
    const created = createClinicalEntry(dentistA, {
      patient_id: "p-a-008",
      chief_complaint: "A",
    });
    expect(() =>
      updateClinicalEntryDraft(dentistA, created.id, {
        patient_id: "p-a-008",
        chief_complaint: "B",
        expected_updated_at: "2000-01-01T00:00:00.000Z",
      }),
    ).toThrow("CONCURRENCY_CONFLICT");
  });
});

describe("retorno pendente", () => {
  it("derivado de follow_up sem consulta futura", () => {
    const fu = getPatientFollowUp(ownerA, "p-a-002");
    expect(fu?.required).toBe(true);
    expect(fu?.pending).toBe(true);
    expect(countPendingFollowUps(ownerA)).toBeGreaterThanOrEqual(1);
  });
});

describe("odontograma", () => {
  it("atualiza dente e persiste", () => {
    const updated = updateTooth(dentistA, {
      patient_id: "p-a-001",
      tooth_number: 16,
      condition: "restoration",
      planned_procedure: null,
      notes: "Concluído",
    });
    expect(updated.condition).toBe("restoration");
    const chart = getOdontogram(dentistA, "p-a-001");
    expect(chart.teeth.find((t) => t.tooth_number === 16)?.condition).toBe(
      "restoration",
    );
  });
});

describe("arquivos e storage", () => {
  it("upload válido e MIME inválido", () => {
    const ok = uploadClinicalAttachment(dentistA, {
      patient_id: "p-a-001",
      type: "pdf",
      file_name: "exame.pdf",
      mime_type: "application/pdf",
      file_size: 1000,
      content_base64: "JVBERi0=",
    });
    expect(ok.id).toBeTruthy();
    expect(ok.patient_visible).toBe(false);

    expect(() =>
      uploadClinicalAttachment(dentistA, {
        patient_id: "p-a-001",
        type: "other",
        file_name: "x.exe",
        mime_type: "application/x-msdownload",
        file_size: 10,
      }),
    ).toThrow("MIME_NOT_ALLOWED");
  });

  it("cross-clinic por path é negado", () => {
    expect(() =>
      tryAccessByStoragePath(
        dentistA,
        `clinic/${CLINIC_B_ID}/patient/p-b-001/clinical/att-b-1.jpg`,
      ),
    ).toThrow("ATTACHMENT_NOT_FOUND");
  });

  it("dentist A não acessa attachment B", () => {
    expect(() => getClinicalAttachmentAccess(dentistA, "att-b-1")).toThrow(
      "ATTACHMENT_NOT_FOUND",
    );
  });
});

describe("cross-clinic clínico", () => {
  it("Dentist A não lê paciente Clinic B", () => {
    expect(() => getClinicalSummary(dentistA, "p-b-001")).toThrow(
      "PATIENT_NOT_FOUND",
    );
    expect(() => listClinicalEntries(dentistA, "p-b-001")).toThrow(
      "PATIENT_NOT_FOUND",
    );
  });
});
