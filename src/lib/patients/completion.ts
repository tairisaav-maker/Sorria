import { isMinor } from "@/lib/patients/age";
import type { Patient } from "@/types/patient";

type FieldKey =
  | "full_name"
  | "birth_date"
  | "phone"
  | "cpf"
  | "email"
  | "address"
  | "emergency"
  | "guardian";

function hasAddress(patient: Pick<
  Patient,
  "postal_code" | "street" | "city" | "state"
>) {
  return Boolean(
    patient.postal_code || patient.street || patient.city || patient.state,
  );
}

function hasEmergency(patient: Pick<
  Patient,
  "emergency_contact_name" | "emergency_contact_phone"
>) {
  return Boolean(
    patient.emergency_contact_name && patient.emergency_contact_phone,
  );
}

function hasGuardian(patient: Pick<
  Patient,
  "guardian_name" | "guardian_phone" | "guardian_relationship"
>) {
  return Boolean(
    patient.guardian_name &&
      patient.guardian_phone &&
      patient.guardian_relationship,
  );
}

/** Completude cadastral administrativa (nunca chamar de prontuário). */
export function calcRegistrationCompletion(
  patient: Pick<
    Patient,
    | "full_name"
    | "birth_date"
    | "phone"
    | "cpf"
    | "email"
    | "postal_code"
    | "street"
    | "city"
    | "state"
    | "emergency_contact_name"
    | "emergency_contact_phone"
    | "guardian_name"
    | "guardian_phone"
    | "guardian_relationship"
  >,
): { percent: number; missing: FieldKey[]; guardianRequired: boolean } {
  const guardianRequired = isMinor(patient.birth_date);
  const checks: Array<{ key: FieldKey; ok: boolean }> = [
    { key: "full_name", ok: Boolean(patient.full_name?.trim()) },
    { key: "birth_date", ok: Boolean(patient.birth_date) },
    { key: "phone", ok: Boolean(patient.phone) },
    { key: "cpf", ok: Boolean(patient.cpf) },
    { key: "email", ok: Boolean(patient.email) },
    { key: "address", ok: hasAddress(patient) },
    { key: "emergency", ok: hasEmergency(patient) },
  ];

  if (guardianRequired) {
    checks.push({ key: "guardian", ok: hasGuardian(patient) });
  }

  const filled = checks.filter((c) => c.ok).length;
  const percent = Math.round((filled / checks.length) * 100);
  const missing = checks.filter((c) => !c.ok).map((c) => c.key);

  return { percent, missing, guardianRequired };
}
