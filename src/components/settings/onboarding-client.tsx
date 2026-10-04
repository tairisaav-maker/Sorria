"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  type ClinicHoursConfig,
  type WeekdayKey,
} from "@/types/clinic-settings";

type Step = "welcome" | "clinic" | "profile" | "hours" | "procedures" | "next";

const STEPS: Step[] = [
  "welcome",
  "clinic",
  "profile",
  "hours",
  "procedures",
  "next",
];

export function OnboardingClient() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("step") as Step) || "welcome";
  const [step, setStep] = useState<Step>(
    STEPS.includes(initial) ? initial : "welcome",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clinicForm, setClinicForm] = useState({
    name: "",
    phone: "",
    city: "",
    timezone: "America/Sao_Paulo",
  });
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    professional_name: "",
    cro: "",
    cro_uf: "MG",
    phone: "",
    specialty: "",
  });
  const [hours, setHours] = useState<ClinicHoursConfig | null>(null);
  const [procPicks, setProcPicks] = useState<
    Array<{ id: string; label: string; template_ids: string[] }>
  >([]);
  const [selectedPicks, setSelectedPicks] = useState<Set<string>>(new Set());
  const [importingProcs, setImportingProcs] = useState(false);

  useEffect(() => {
    void (async () => {
      const [clinicRes, profileRes] = await Promise.all([
        fetch("/api/demo/settings?resource=clinic"),
        fetch("/api/demo/settings?resource=profile"),
      ]);
      if (clinicRes.ok) {
        const c = await clinicRes.json();
        setClinicForm({
          name: c.name ?? "",
          phone: c.phone ?? "",
          city: c.city ?? "",
          timezone: c.timezone ?? "America/Sao_Paulo",
        });
        setHours(c.hours);
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        if (p) {
          setProfileForm({
            full_name: p.full_name ?? "",
            professional_name: p.professional_name ?? "",
            cro: p.cro ?? "",
            cro_uf: p.cro_uf ?? "MG",
            phone: p.phone ?? "",
            specialty: p.specialty ?? "",
          });
        }
      }
    })();
  }, []);

  const title = useMemo(() => {
    switch (step) {
      case "welcome":
        return "Bem-vinda ao Sorria";
      case "clinic":
        return "Sua clínica";
      case "profile":
        return "Seu perfil";
      case "hours":
        return "Horários de atendimento";
      case "procedures":
        return "Quais procedimentos você mais realiza?";
      default:
        return "Próximos passos";
    }
  }, [step]);

  useEffect(() => {
    if (step !== "procedures") return;
    void fetch("/api/demo/procedure-library?view=onboarding_picks")
      .then((r) => r.json())
      .then((data) => setProcPicks(data.picks ?? []));
  }, [step]);

  async function importSelectedProcedures() {
    const ids = procPicks
      .filter((p) => selectedPicks.has(p.id))
      .flatMap((p) => p.template_ids);
    if (ids.length === 0) {
      setStep("next");
      return;
    }
    setImportingProcs(true);
    setError(null);
    const res = await fetch("/api/demo/procedure-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import_batch",
        data: {
          procedure_template_ids: ids,
          create_missing_materials: true,
        },
      }),
    });
    setImportingProcs(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Não foi possível importar os modelos.");
      return;
    }
    setStep("next");
  }

  async function post(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveClinic() {
    const ok = await post("update_clinic", {
      payload: {
        name: clinicForm.name,
        phone: clinicForm.phone || null,
        city: clinicForm.city || null,
        timezone: clinicForm.timezone,
      },
    });
    if (ok) setStep("profile");
  }

  async function saveProfile() {
    const ok = await post("update_profile", {
      payload: {
        full_name: profileForm.full_name,
        professional_name: profileForm.professional_name || null,
        cro: profileForm.cro || null,
        cro_uf: profileForm.cro_uf || null,
        phone: profileForm.phone || null,
        specialty: profileForm.specialty || null,
      },
    });
    if (ok) setStep("hours");
  }

  async function saveHours() {
    if (!hours) return;
    const ok = await post("update_hours", { hours });
    if (ok) setStep("procedures");
  }

  function copyMondayToWeekdays() {
    if (!hours) return;
    const src = hours.mon;
    const next = { ...hours };
    for (const d of ["tue", "wed", "thu", "fri"] as WeekdayKey[]) {
      next[d] = {
        enabled: src.enabled,
        periods: src.periods.map((p) => ({ ...p })),
      };
    }
    setHours(next);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="animate-fade-in">
        <p className="text-sm font-medium text-[var(--brand-primary)]">Onboarding</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          {title}
        </h1>
      </header>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {step === "welcome" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5 animate-rise">
          <p className="text-sm text-[var(--text-muted)]">
            Vamos configurar o essencial para você começar a usar o consultório.
          </p>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Você pode pular etapas e concluir depois — o progresso fica salvo.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              loading={busy}
              onClick={async () => {
                await post("onboarding_step", { step: "welcome" });
                setStep("clinic");
              }}
            >
              Começar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await post("onboarding_step", { step: "dismiss" });
                router.push("/app/home");
              }}
            >
              Continuar depois
            </Button>
          </div>
        </section>
      ) : null}

      {step === "clinic" ? (
        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <div>
            <Label htmlFor="clinic-name">Nome da clínica</Label>
            <Input
              id="clinic-name"
              autoComplete="organization"
              value={clinicForm.name}
              onChange={(e) => setClinicForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="clinic-phone">Telefone</Label>
            <Input
              id="clinic-phone"
              autoComplete="tel"
              value={clinicForm.phone}
              onChange={(e) => setClinicForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="clinic-city">Cidade</Label>
            <Input
              id="clinic-city"
              autoComplete="address-level2"
              value={clinicForm.city}
              onChange={(e) => setClinicForm((s) => ({ ...s, city: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="clinic-tz">Timezone</Label>
            <select
              id="clinic-tz"
              className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
              value={clinicForm.timezone}
              onChange={(e) =>
                setClinicForm((s) => ({ ...s, timezone: e.target.value }))
              }
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo</option>
              <option value="America/Manaus">America/Manaus</option>
              <option value="America/Fortaleza">America/Fortaleza</option>
              <option value="America/Recife">America/Recife</option>
              <option value="America/Belem">America/Belem</option>
            </select>
            <p className="mt-1 text-xs text-[var(--text-subtle)]">
              Obrigatório para agenda e relatórios consistentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" loading={busy} onClick={() => void saveClinic()}>
              Continuar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("profile")}>
              Pular
            </Button>
          </div>
        </section>
      ) : null}

      {step === "profile" ? (
        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <div>
            <Label htmlFor="full-name">Nome</Label>
            <Input
              id="full-name"
              autoComplete="name"
              value={profileForm.full_name}
              onChange={(e) =>
                setProfileForm((s) => ({ ...s, full_name: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="prof-name">Nome profissional</Label>
            <Input
              id="prof-name"
              value={profileForm.professional_name}
              onChange={(e) =>
                setProfileForm((s) => ({
                  ...s,
                  professional_name: e.target.value,
                }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cro">CRO</Label>
              <Input
                id="cro"
                value={profileForm.cro}
                onChange={(e) =>
                  setProfileForm((s) => ({ ...s, cro: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="cro-uf">UF</Label>
              <Input
                id="cro-uf"
                maxLength={2}
                value={profileForm.cro_uf}
                onChange={(e) =>
                  setProfileForm((s) => ({
                    ...s,
                    cro_uf: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="prof-phone">Telefone</Label>
            <Input
              id="prof-phone"
              autoComplete="tel"
              value={profileForm.phone}
              onChange={(e) =>
                setProfileForm((s) => ({ ...s, phone: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="specialty">Especialidade (opcional)</Label>
            <Input
              id="specialty"
              value={profileForm.specialty}
              onChange={(e) =>
                setProfileForm((s) => ({ ...s, specialty: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" loading={busy} onClick={() => void saveProfile()}>
              Continuar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("hours")}>
              Pular
            </Button>
          </div>
        </section>
      ) : null}

      {step === "hours" && hours ? (
        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={copyMondayToWeekdays}>
              Copiar segunda → dias úteis
            </Button>
          </div>
          <ul className="space-y-3">
            {WEEKDAY_ORDER.map((day) => {
              const d = hours[day];
              return (
                <li key={day} className="rounded-xl border border-[var(--border)] p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) =>
                        setHours({
                          ...hours,
                          [day]: { ...d, enabled: e.target.checked },
                        })
                      }
                    />
                    {WEEKDAY_LABELS[day]}
                  </label>
                  {d.enabled
                    ? d.periods.map((p, idx) => (
                        <div key={idx} className="mt-2 flex items-center gap-2 text-sm">
                          <Input
                            type="time"
                            value={p.start}
                            onChange={(e) => {
                              const periods = d.periods.map((x, i) =>
                                i === idx ? { ...x, start: e.target.value } : x,
                              );
                              setHours({ ...hours, [day]: { ...d, periods } });
                            }}
                          />
                          <span className="text-[var(--text-muted)]">–</span>
                          <Input
                            type="time"
                            value={p.end}
                            onChange={(e) => {
                              const periods = d.periods.map((x, i) =>
                                i === idx ? { ...x, end: e.target.value } : x,
                              );
                              setHours({ ...hours, [day]: { ...d, periods } });
                            }}
                          />
                        </div>
                      ))
                    : (
                      <p className="mt-1 text-xs text-[var(--text-subtle)]">Fechado</p>
                    )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" loading={busy} onClick={() => void saveHours()}>
              Continuar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("procedures")}
            >
              Pular
            </Button>
          </div>
        </section>
      ) : null}

      {step === "procedures" ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5 animate-rise">
          <p className="text-sm text-[var(--text-muted)]">
            Escolha os mais comuns. O Sorria importa modelos editáveis com ficha
            de materiais — sem protocolo clínico obrigatório.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {procPicks.map((p) => {
              const checked = selectedPicks.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedPicks);
                      if (checked) next.delete(p.id);
                      else next.add(p.id);
                      setSelectedPicks(next);
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                      checked
                        ? "border-[var(--brand-primary)] bg-[var(--brand-soft)] text-[var(--brand-ink)]"
                        : "border-[var(--border)] hover:bg-[var(--surface-muted)]/60",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex size-5 items-center justify-center rounded border text-xs",
                        checked
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                          : "border-[var(--border)]",
                      ].join(" ")}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-[var(--text-subtle)]">
            Depois: configure materiais um a um (usar modelo / editar / pular) em
            Procedimentos.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={importingProcs}
              onClick={() => void importSelectedProcedures()}
            >
              Adicionar à minha clínica
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("next")}
            >
              Pular
            </Button>
          </div>
        </section>
      ) : null}

      {step === "next" ? (
        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <p className="text-sm text-[var(--text-muted)]">
            Vamos configurar os materiais? Abra um procedimento e use o modelo
            ou personalize. O Sorria mostra o{" "}
            <strong>custo estimado</strong> quando houver preços reais — sem
            inventar totais.
          </p>
          <ol className="space-y-2 text-sm">
            <li>
              <Link
                href="/app/procedimentos/novo?from=onboarding"
                className="block rounded-xl border border-[var(--border)] px-4 py-3 font-medium hover:bg-[var(--surface-muted)]/60"
              >
                3. Biblioteca de procedimentos
              </Link>
            </li>
            <li>
              <Link
                href="/app/procedimentos?from=onboarding"
                className="block rounded-xl border border-[var(--border)] px-4 py-3 font-medium hover:bg-[var(--surface-muted)]/60"
              >
                4. Materiais / ficha técnica
              </Link>
            </li>
            <li>
              <Link
                href="/app/estoque?from=onboarding"
                className="block rounded-xl border border-[var(--border)] px-4 py-3 font-medium hover:bg-[var(--surface-muted)]/60"
              >
                5. Estoque inicial (saldo + custo estimado)
              </Link>
            </li>
            <li>
              <Link
                href="/app/pacientes/novo?from=onboarding"
                className="block rounded-xl border border-[var(--border)] px-4 py-3 font-medium hover:bg-[var(--surface-muted)]/60"
              >
                6. Primeiro paciente
              </Link>
            </li>
          </ol>
          <p className="text-xs text-[var(--text-subtle)]">
            Etapas 1–2 (clínica e horários) já foram nesta tela. Nada é
            obrigatório — uso progressivo.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/app/agenda")}
          >
            Ir para a Agenda
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/app/home")}
          >
            Ir para o Início
          </Button>
        </section>
      ) : null}
    </div>
  );
}
