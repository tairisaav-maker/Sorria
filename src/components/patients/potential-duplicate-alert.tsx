import Link from "next/link";
import { Button } from "@/components/ui/button";
import { calcAge } from "@/lib/patients/age";
import { formatPhoneBR } from "@/lib/patients/normalize";
import type { DuplicateMatch } from "@/types/patient";

export function PotentialDuplicateAlert({
  duplicates,
  onContinue,
  onCancel,
}: {
  duplicates: DuplicateMatch[];
  onContinue: () => void;
  onCancel: () => void;
}) {
  const primary = duplicates[0];
  if (!primary) return null;

  const age = calcAge(primary.patient.birth_date);
  const phone = formatPhoneBR(primary.patient.phone);
  const phoneHint = phone ? `Telefone final ${phone.slice(-4)}` : null;
  const isCpf = primary.reasons.includes("cpf");

  return (
    <div
      className="rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning-soft)] p-4"
      role="alert"
    >
      <p className="text-sm font-semibold text-[var(--warning)]">
        {isCpf
          ? "Este paciente pode já estar cadastrado"
          : "Encontramos um cadastro parecido. Confira antes de continuar."}
      </p>
      <p className="mt-2 text-sm text-[var(--text)]">
        Encontramos: <strong>{primary.patient.full_name}</strong>
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        {[
          phoneHint,
          primary.patient.birth_date
            ? `Nascimento ${primary.patient.birth_date.split("-").reverse().join("/")}`
            : null,
          age !== null ? `${age} anos` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/app/pacientes/${primary.patient.id}`}
          className="inline-flex h-9 items-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium"
        >
          Ver paciente
        </Link>
        <Button type="button" size="sm" onClick={onContinue}>
          Continuar mesmo assim
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
