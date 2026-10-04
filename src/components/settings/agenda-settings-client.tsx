"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  type ClinicHoursConfig,
  type WeekdayKey,
} from "@/types/clinic-settings";

export function AgendaSettingsClient() {
  const [hours, setHours] = useState<ClinicHoursConfig | null>(null);
  const [slot, setSlot] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/demo/settings?resource=clinic");
      if (!res.ok) return;
      const c = await res.json();
      setHours(c.hours);
      setSlot(c.slot_minutes ?? 30);
    })();
  }, []);

  function copyMonday() {
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

  async function save() {
    if (!hours) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const hoursRes = await fetch("/api/demo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_hours", hours }),
      });
      const hoursData = await hoursRes.json();
      if (!hoursRes.ok) throw new Error(hoursData.error ?? "Erro");
      const clinicRes = await fetch("/api/demo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_clinic",
          payload: { slot_minutes: slot },
        }),
      });
      const clinicData = await clinicRes.json();
      if (!clinicRes.ok) throw new Error(clinicData.error ?? "Erro");
      setMsg("Horários da agenda salvos.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!hours) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando horários…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Agenda
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Dias de funcionamento, períodos e duração padrão dos slots.
        </p>
      </header>
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {msg ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">{msg}</p>
      ) : null}
      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-sm">
            Duração padrão (min)
            <Input
              type="number"
              className="mt-1 w-28"
              min={5}
              max={240}
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value) || 30)}
            />
          </label>
          <Button type="button" size="sm" variant="secondary" onClick={copyMonday}>
            Copiar segunda → úteis
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
                {d.enabled ? (
                  d.periods.map((p, idx) => (
                    <div key={idx} className="mt-2 flex items-center gap-2">
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
                      <span>–</span>
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
                ) : (
                  <p className="mt-1 text-xs text-[var(--text-subtle)]">Fechado</p>
                )}
              </li>
            );
          })}
        </ul>
        <Button type="button" loading={busy} onClick={() => void save()}>
          Salvar horários
        </Button>
      </section>
    </div>
  );
}
