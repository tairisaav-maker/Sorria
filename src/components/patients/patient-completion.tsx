import { calcRegistrationCompletion } from "@/lib/patients/completion";
import type { Patient } from "@/types/patient";

export function PatientCompletion({ patient }: { patient: Patient }) {
  const { percent, missing, guardianRequired } = calcRegistrationCompletion(
    patient,
  );

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <p className="text-sm font-medium text-[var(--text)]">
        Cadastro {percent}% completo
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Completude do cadastro administrativo"
      >
        <div
          className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Pendências administrativas: {missing.join(", ")}.
          {guardianRequired && missing.includes("guardian")
            ? " Responsável incompleto para menor de idade."
            : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Cadastro administrativo completo.
        </p>
      )}
    </div>
  );
}
