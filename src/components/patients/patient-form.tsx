"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { PotentialDuplicateAlert } from "@/components/patients/potential-duplicate-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isMinor } from "@/lib/patients/age";
import {
  createPatientSchema,
  type PatientFormValues,
} from "@/lib/validations/patient";
import {
  PATIENT_STATUS_LABELS,
  REFERRAL_SOURCES,
  type DuplicateMatch,
  type Patient,
} from "@/types/patient";

export function PatientForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Patient;
}) {
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createPatientSchema) as any,
    defaultValues: {
      full_name: initial?.full_name ?? "",
      preferred_name: initial?.preferred_name ?? "",
      birth_date: initial?.birth_date ?? "",
      cpf: initial?.cpf ?? "",
      phone: initial?.phone ?? "",
      secondary_phone: initial?.secondary_phone ?? "",
      email: initial?.email ?? "",
      postal_code: initial?.postal_code ?? "",
      street: initial?.street ?? "",
      number: initial?.number ?? "",
      complement: initial?.complement ?? "",
      neighborhood: initial?.neighborhood ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      guardian_name: initial?.guardian_name ?? "",
      guardian_phone: initial?.guardian_phone ?? "",
      guardian_relationship: initial?.guardian_relationship ?? "",
      emergency_contact_name: initial?.emergency_contact_name ?? "",
      emergency_contact_phone: initial?.emergency_contact_phone ?? "",
      emergency_contact_relationship:
        initial?.emergency_contact_relationship ?? "",
      referral_source: initial?.referral_source ?? "",
      administrative_notes: initial?.administrative_notes ?? "",
      status: initial?.status ?? "active",
      acknowledge_duplicate: false,
    },
  });

  const birthDate = watch("birth_date");
  const minor = useMemo(() => isMinor(birthDate || null), [birthDate]);

  async function submit(values: PatientFormValues) {
    setError(null);
    setSuccess(null);

    const payload = {
      ...values,
      action: mode === "edit" ? "update" : undefined,
      id: initial?.id,
    };

    const response = await fetch("/api/demo/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      error?: string;
      duplicates?: DuplicateMatch[];
      patient?: Patient;
      message?: string;
    };

    if (response.status === 409 && data.duplicates) {
      setDuplicates(data.duplicates);
      return;
    }

    if (!response.ok || !data.patient) {
      setError(
        data.error ?? "Não foi possível salvar as alterações. Tente novamente.",
      );
      return;
    }

    if (mode === "edit") {
      setSuccess(data.message ?? "Alterações salvas.");
      router.refresh();
      return;
    }

    router.push(`/app/pacientes/${data.patient.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {duplicates ? (
        <PotentialDuplicateAlert
          duplicates={duplicates}
          onCancel={() => setDuplicates(null)}
          onContinue={() => {
            setValue("acknowledge_duplicate", true);
            setDuplicates(null);
            void handleSubmit(submit)();
          }}
        />
      ) : null}

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Dados principais
        </h2>
        <div>
          <Label htmlFor="full_name">Nome completo *</Label>
          <Input id="full_name" {...register("full_name")} />
          {errors.full_name ? (
            <p className="mt-1 text-xs text-[var(--danger)]">
              {errors.full_name.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="preferred_name">Como prefere ser chamado</Label>
          <Input id="preferred_name" {...register("preferred_name")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="birth_date">Data de nascimento</Label>
            <Input id="birth_date" type="date" {...register("birth_date")} />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" inputMode="numeric" {...register("cpf")} />
            {errors.cpf ? (
              <p className="mt-1 text-xs text-[var(--danger)]">
                {errors.cpf.message}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Contato
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone ? (
              <p className="mt-1 text-xs text-[var(--danger)]">
                {errors.phone.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="secondary_phone">Telefone secundário</Label>
            <Input id="secondary_phone" {...register("secondary_phone")} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email ? (
            <p className="mt-1 text-xs text-[var(--danger)]">
              {errors.email.message}
            </p>
          ) : null}
        </div>
      </section>

      {minor ? (
        <section className="space-y-4 rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-soft)]/50 p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Responsável
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Paciente menor de idade — complete os dados do responsável.
          </p>
          <div>
            <Label htmlFor="guardian_name">Nome</Label>
            <Input id="guardian_name" {...register("guardian_name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="guardian_relationship">Relação</Label>
              <Input
                id="guardian_relationship"
                {...register("guardian_relationship")}
              />
            </div>
            <div>
              <Label htmlFor="guardian_phone">Telefone</Label>
              <Input id="guardian_phone" {...register("guardian_phone")} />
            </div>
          </div>
        </section>
      ) : null}

      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Ocultar informações adicionais" : "Adicionar mais informações"}
        </Button>
      </div>

      {showMore || mode === "edit" ? (
        <>
          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
              Endereço
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="postal_code">CEP</Label>
                <Input id="postal_code" {...register("postal_code")} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="street">Rua</Label>
                <Input id="street" {...register("street")} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="number">Número</Label>
                <Input id="number" {...register("number")} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input id="complement" {...register("complement")} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" {...register("neighborhood")} />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" {...register("city")} />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input id="state" maxLength={2} {...register("state")} />
              </div>
            </div>
          </section>

          {!minor ? (
            <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
                Responsável
              </h2>
              <div>
                <Label htmlFor="guardian_name_opt">Nome</Label>
                <Input id="guardian_name_opt" {...register("guardian_name")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="guardian_relationship_opt">Relação</Label>
                  <Input
                    id="guardian_relationship_opt"
                    {...register("guardian_relationship")}
                  />
                </div>
                <div>
                  <Label htmlFor="guardian_phone_opt">Telefone</Label>
                  <Input
                    id="guardian_phone_opt"
                    {...register("guardian_phone")}
                  />
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
              Contato de emergência
            </h2>
            <div>
              <Label htmlFor="emergency_contact_name">Nome</Label>
              <Input
                id="emergency_contact_name"
                {...register("emergency_contact_name")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="emergency_contact_relationship">Relação</Label>
                <Input
                  id="emergency_contact_relationship"
                  {...register("emergency_contact_relationship")}
                />
              </div>
              <div>
                <Label htmlFor="emergency_contact_phone">Telefone</Label>
                <Input
                  id="emergency_contact_phone"
                  {...register("emergency_contact_phone")}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
              Administrativo
            </h2>
            <div>
              <Label htmlFor="referral_source">
                Como conheceu o consultório?
              </Label>
              <Select id="referral_source" {...register("referral_source")}>
                <option value="">Selecione</option>
                {REFERRAL_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </Select>
            </div>
            {mode === "edit" ? (
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" {...register("status")}>
                  {Object.entries(PATIENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div>
              <Label htmlFor="administrative_notes">
                Observação administrativa
              </Label>
              <Textarea
                id="administrative_notes"
                {...register("administrative_notes")}
              />
              <p className="mt-1 text-xs text-[var(--text-subtle)]">
                Não utilize este campo para informações clínicas.
              </p>
            </div>
          </section>
        </>
      ) : null}

      {error ? (
        <p
          className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === "edit" ? "Salvar alterações" : "Salvar paciente"}
        </Button>
      </div>
    </form>
  );
}
