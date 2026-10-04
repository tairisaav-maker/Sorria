import { listAllPatients } from "@/lib/demo/patients-store";
import {
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
} from "@/lib/patients/normalize";
import type { DuplicateMatch, Patient } from "@/types/patient";

export type DuplicateInput = {
  clinicId: string;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  full_name?: string | null;
  birth_date?: string | null;
  excludePatientId?: string;
};

/**
 * Duplicidade apenas no tenant atual.
 * Ordem: CPF > telefone > e-mail > nome+nascimento.
 * Nome semelhante isolado NÃO bloqueia.
 */
export function checkPotentialDuplicates(
  input: DuplicateInput,
): DuplicateMatch[] {
  const cpf = normalizeCpf(input.cpf);
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const name = input.full_name?.trim().toLowerCase();
  const birth = input.birth_date || null;

  const matches: DuplicateMatch[] = [];

  for (const patient of listAllPatients()) {
    if (patient.clinic_id !== input.clinicId) continue;
    if (input.excludePatientId && patient.id === input.excludePatientId) continue;
    if (patient.status === "archived") continue;

    const reasons: DuplicateMatch["reasons"] = [];

    if (cpf && patient.cpf_normalized === cpf) reasons.push("cpf");
    if (phone && patient.phone_normalized === phone) reasons.push("phone");
    if (email && patient.email_normalized === email) reasons.push("email");
    if (
      name &&
      birth &&
      patient.full_name.trim().toLowerCase() === name &&
      patient.birth_date === birth
    ) {
      reasons.push("name_birth");
    }

    if (reasons.length === 0) continue;

    matches.push({
      patient,
      reasons,
      severity: reasons.includes("cpf") ? "high" : "medium",
    });
  }

  return matches.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "high" ? -1 : 1;
  });
}

export function hasExactCpfDuplicate(
  clinicId: string,
  cpf: string | null | undefined,
  excludePatientId?: string,
): Patient | null {
  const normalized = normalizeCpf(cpf);
  if (!normalized) return null;
  return (
    listAllPatients().find(
      (p) =>
        p.clinic_id === clinicId &&
        p.cpf_normalized === normalized &&
        p.status !== "archived" &&
        p.id !== excludePatientId,
    ) ?? null
  );
}
