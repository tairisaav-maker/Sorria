import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import { getPatientRecord, listAllPatients } from "@/lib/demo/patients-store";
import {
  digitsOnly,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
} from "@/lib/patients/normalize";
import type {
  Patient,
  PatientListItem,
  PatientSort,
  PatientStatusFilter,
} from "@/types/patient";

const PAGE_SIZE = 25;

export type ListPatientsParams = {
  query?: string;
  status?: PatientStatusFilter;
  sort?: PatientSort;
  page?: number;
  pageSize?: number;
};

function matchesQuery(patient: Patient, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const digits = digitsOnly(q);
  const nameHay = `${patient.full_name} ${patient.preferred_name ?? ""}`.toLowerCase();

  if (nameHay.includes(q)) return true;
  if (patient.email_normalized?.includes(q)) return true;

  if (digits.length >= 3) {
    if (patient.phone_normalized?.includes(digits)) return true;
    if (patient.secondary_phone_normalized?.includes(digits)) return true;
    if (patient.cpf_normalized?.includes(digits)) return true;
  }

  // formatted search helpers
  const phoneQ = normalizePhone(q);
  const cpfQ = normalizeCpf(q);
  const emailQ = normalizeEmail(q);
  if (phoneQ && patient.phone_normalized?.includes(phoneQ)) return true;
  if (cpfQ && patient.cpf_normalized?.includes(cpfQ)) return true;
  if (emailQ && patient.email_normalized?.includes(emailQ)) return true;

  return false;
}

function sortPatients(items: Patient[], sort: PatientSort): Patient[] {
  const copy = [...items];
  switch (sort) {
    case "name_desc":
      return copy.sort((a, b) => b.full_name.localeCompare(a.full_name, "pt-BR"));
    case "newest":
      return copy.sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      );
    case "updated":
      return copy.sort(
        (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
      );
    case "name_asc":
    default:
      return copy.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  }
}

function toListItem(patient: Patient): PatientListItem {
  return {
    id: patient.id,
    clinic_id: patient.clinic_id,
    full_name: patient.full_name,
    preferred_name: patient.preferred_name,
    phone: patient.phone,
    phone_normalized: patient.phone_normalized,
    birth_date: patient.birth_date,
    status: patient.status,
    updated_at: patient.updated_at,
    created_at: patient.created_at,
  };
}

export function listPatients(ctx: AuthzContext, params: ListPatientsParams = {}) {
  assertPermission(ctx, "patients.demographics.view");

  const status = params.status ?? "all";
  const sort = params.sort ?? "name_asc";
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const query = params.query ?? "";

  let items = listAllPatients().filter((p) => p.clinic_id === ctx.clinicId);

  if (status === "all") {
    items = items.filter((p) => p.status !== "archived");
  } else {
    items = items.filter((p) => p.status === status);
  }

  if (query.trim()) {
    items = items.filter((p) => matchesQuery(p, query));
  }

  items = sortPatients(items, sort);
  const total = items.length;
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize).map(toListItem);

  return {
    items: pageItems,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function getPatient(ctx: AuthzContext, patientId: string): Patient {
  assertPermission(ctx, "patients.demographics.view");

  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    const error = new Error("PATIENT_NOT_FOUND");
    throw error;
  }

  // contact / administrative gated softly for field exposure at UI level;
  // record access still requires demographics.view as list/profile entry.
  return patient;
}

export function searchPatients(ctx: AuthzContext, query: string) {
  return listPatients(ctx, { query, page: 1, status: "all" });
}

export { PAGE_SIZE };
