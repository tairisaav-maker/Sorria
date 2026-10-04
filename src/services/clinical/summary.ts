import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import { ANAMNESIS_SECTIONS } from "@/lib/clinical/anamnesis-template";
import { getAnamnesis } from "@/services/anamnesis";
import {
  getPatientFollowUp,
  listClinicalEntries,
} from "@/services/clinical/entries";
import { getOdontogram } from "@/services/odontogram";
import {
  getPatientLastAppointment,
  getPatientNextAppointment,
} from "@/services/appointments";
import type { ClinicalAlert, ClinicalSummary } from "@/types/clinical";
import { ANAMNESIS_STATUS_LABELS } from "@/types/clinical";
import { getPatientRecord } from "@/lib/demo/patients-store";

function deriveAlerts(
  answers: { question_key: string; value_bool: boolean | null; value_text: string | null }[],
): ClinicalAlert[] {
  const map = new Map(answers.map((a) => [a.question_key, a]));
  const alerts: ClinicalAlert[] = [];

  for (const section of ANAMNESIS_SECTIONS) {
    for (const q of section.questions) {
      if (!q.alertIfTrue) continue;
      const ans = map.get(q.key);
      if (!ans) continue;

      if (q.type === "bool" && ans.value_bool === true) {
        alerts.push({
          id: q.key,
          severity: q.alertIfTrue.severity,
          label: q.alertIfTrue.label,
          detail: "",
        });
      }
      if (q.type === "text" && ans.value_text) {
        const parent = q.showIf ? map.get(q.showIf.key) : null;
        if (!q.showIf || parent?.value_bool === q.showIf.equals) {
          alerts.push({
            id: q.key,
            severity: q.alertIfTrue.severity,
            label: q.alertIfTrue.label,
            detail: ans.value_text,
          });
        }
      }
    }
  }

  // Alergia: se has_allergy true, preferir detalhe
  if (map.get("has_allergy")?.value_bool && !alerts.some((a) => a.id === "allergy_detail")) {
    alerts.unshift({
      id: "has_allergy",
      severity: "high",
      label: "Alergia registrada",
      detail: map.get("allergy_detail")?.value_text || "",
    });
  }

  return alerts;
}

export function getClinicalSummary(
  ctx: AuthzContext,
  patientId: string,
): ClinicalSummary {
  assertPermission(ctx, "clinical_record.view");
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }

  const { anamnesis, answers } = getAnamnesis(ctx, patientId);
  const entries = listClinicalEntries(ctx, patientId);
  const lastEntry = entries.find((e) => e.status === "finalized") ?? null;
  const odontogram = getOdontogram(ctx, patientId);
  const followUp = getPatientFollowUp(ctx, patientId);

  let nextAppointment = null;
  let lastAppointment = null;
  try {
    const next = getPatientNextAppointment(ctx, patientId);
    if (next) {
      nextAppointment = {
        id: next.id,
        start_at: next.start_at,
        status: next.status,
      };
    }
    const last = getPatientLastAppointment(ctx, patientId);
    if (last) {
      lastAppointment = {
        id: last.id,
        start_at: last.start_at,
        status: last.status,
      };
    }
  } catch {
    // sem appointments.view — omitir
  }

  return {
    alerts: anamnesis ? deriveAlerts(answers) : [],
    anamnesisStatus: anamnesis?.status ?? null,
    anamnesisLabel: anamnesis
      ? ANAMNESIS_STATUS_LABELS[anamnesis.status]
      : "Não preenchida",
    lastEntry,
    lastAppointment,
    nextAppointment,
    odontogramUpdatedAt: odontogram.updatedAt,
    followUp,
  };
}
