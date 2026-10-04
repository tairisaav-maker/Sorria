import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import { getProfile } from "@/lib/demo/authz-store";
import {
  calculateProcedureOutstandingBalance,
  calculateProcedureReceivedAmount,
  getProcedureFinanceBreakdown,
} from "@/services/patient-procedure-finance";
import { canViewProcedureCosts } from "@/services/performed-procedures/costs";
import { getPatientFinancialSummary } from "@/services/finance";
import type {
  PatientOperationalFinancialSummary,
  TodayOperationalKpis,
} from "@/types/patient-procedure-finance";
import { FORECAST_ELIGIBLE_STATUSES } from "@/services/inventory/forecast";

function canViewFinance(ctx: AuthzContext) {
  return (
    can(ctx, "finance.view_authorized").allowed ||
    can(ctx, "finance.view_administrative").allowed
  );
}

export function getPatientProcedureSummary(
  ctx: AuthzContext,
  patientId: string,
) {
  assertPermission(ctx, "performed_procedures.view");
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
  const showCost = canViewProcedureCosts(ctx);
  const showFinance = canViewFinance(ctx);

  return getPerformedStore()
    .performedProcedures.filter(
      (p) => p.clinic_id === ctx.clinicId && p.patient_id === patientId,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((p) => {
      const finance = getProcedureFinanceBreakdown(ctx, p.id);
      return {
        id: p.id,
        procedure_name_snapshot: p.procedure_name_snapshot,
        tooth_number: p.tooth_number,
        region: p.region,
        status: p.status,
        professional_name:
          getProfile(p.professional_id)?.full_name ?? "Profissional",
        created_at: p.created_at,
        completed_at: p.completed_at,
        appointment_id: p.appointment_id,
        clinical_entry_id: p.clinical_entry_id,
        financial_status: p.financial_status,
        treatment_item_id: p.treatment_item_id,
        actual_total_cost_cents: showCost ? p.actual_total_cost_cents : null,
        charged_amount_cents: finance.charged_amount_cents,
        received_cents: showFinance ? finance.received_cents : null,
        outstanding_cents: showFinance ? finance.outstanding_cents : null,
        gross_result_charged_cents: showCost
          ? finance.gross_result_charged_cents
          : null,
        gross_margin_percent: showCost ? finance.gross_margin_percent : null,
      };
    });
}

export function getPatientOperationalFinancialSummary(
  ctx: AuthzContext,
  patientId: string,
): PatientOperationalFinancialSummary {
  assertPermission(ctx, "performed_procedures.view");
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }

  const showCost = canViewProcedureCosts(ctx);
  const showFinance = canViewFinance(ctx);
  const completed = getPerformedStore().performedProcedures.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.patient_id === patientId &&
      p.status === "completed",
  );

  const last = [...completed].sort((a, b) =>
    (b.completed_at ?? b.created_at).localeCompare(
      a.completed_at ?? a.created_at,
    ),
  )[0];

  let charged: number | null = null;
  let receivedFromProcs: number | null = null;
  if (showFinance || showCost) {
    charged = completed.reduce((s, p) => s + (p.charged_amount_cents ?? 0), 0);
  }
  if (showFinance) {
    receivedFromProcs = completed.reduce(
      (s, p) => s + calculateProcedureReceivedAmount(ctx, p.id),
      0,
    );
  }

  // Saldo do paciente = Financeiro real (obrigações − pagamentos), não só procedimentos
  let outstanding: number | null = null;
  let overdue: number | null = null;
  let receivedFinance: number | null = null;
  if (showFinance) {
    try {
      const fin = getPatientFinancialSummary(ctx, patientId);
      outstanding = fin.receivable_cents;
      overdue = fin.overdue_cents;
      receivedFinance = fin.received_cents;
    } catch {
      outstanding = completed.reduce(
        (s, p) => s + calculateProcedureOutstandingBalance(ctx, p.id),
        0,
      );
      receivedFinance = receivedFromProcs;
    }
  }

  return {
    patient_id: patientId,
    procedures_count: completed.length,
    direct_cost_cents: showCost
      ? completed.reduce((s, p) => s + (p.actual_total_cost_cents ?? 0), 0)
      : null,
    charged_cents: charged,
    received_cents: receivedFinance,
    outstanding_cents: outstanding,
    overdue_cents: overdue,
    last_procedure: last
      ? {
          id: last.id,
          name: last.procedure_name_snapshot,
          completed_at: last.completed_at,
          tooth_number: last.tooth_number,
        }
      : null,
  };
}

export function getTodayOperationalKpis(ctx: AuthzContext): TodayOperationalKpis {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const showCost = canViewProcedureCosts(ctx);
  const showFinance = canViewFinance(ctx);

  const completedToday = getPerformedStore().performedProcedures.filter((p) => {
    if (p.clinic_id !== ctx.clinicId || p.status !== "completed") return false;
    const t = +new Date(p.completed_at ?? p.created_at);
    return t >= +start && t <= +end;
  });

  let materialsCost: number | null = null;
  let charged: number | null = null;
  if (showCost) {
    materialsCost = completedToday.reduce(
      (s, p) => s + (p.actual_total_cost_cents ?? 0),
      0,
    );
  }
  if (showFinance || showCost) {
    charged = completedToday.reduce(
      (s, p) => s + (p.charged_amount_cents ?? 0),
      0,
    );
  }

  let received: number | null = null;
  if (showFinance) {
    received = getFinanceStore()
      .payments.filter(
        (p) =>
          p.clinic_id === ctx.clinicId &&
          !p.reversed_at &&
          +new Date(p.paid_at) >= +start &&
          +new Date(p.paid_at) <= +end,
      )
      .reduce((s, p) => s + p.amount_cents, 0);
  }

  return {
    procedures_completed: can(ctx, "performed_procedures.view").allowed
      ? completedToday.length
      : 0,
    materials_cost_cents: materialsCost,
    charged_cents: charged,
    received_cents: received,
  };
}

export function getPatientClinicalOperationalHints(
  ctx: AuthzContext,
  patientId: string,
) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
  const now = Date.now();
  const next = getAgendaStore()
    .appointments.filter(
      (a) =>
        a.clinic_id === ctx.clinicId &&
        a.patient_id === patientId &&
        !a.cancelled_at &&
        FORECAST_ELIGIBLE_STATUSES.includes(a.status) &&
        +new Date(a.start_at) >= now,
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];

  const summary = getPatientOperationalFinancialSummary(ctx, patientId);
  return {
    last_procedure: summary.last_procedure,
    next_appointment: next
      ? { id: next.id, start_at: next.start_at, reason: next.reason }
      : null,
  };
}
