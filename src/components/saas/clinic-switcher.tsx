"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ClinicOpt = { clinic_id: string; clinic_name: string; role_key: string };

export function ClinicSwitcher() {
  const router = useRouter();
  const [items, setItems] = useState<ClinicOpt[]>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    void fetch("/api/demo/saas?view=clinics")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setCurrent(d.current ?? "");
      })
      .catch(() => undefined);
  }, []);

  if (items.length <= 1) return null;

  return (
    <label className="hidden items-center gap-2 text-sm lg:flex">
      <span className="sr-only">Clínica ativa</span>
      <select
        className="h-9 max-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2"
        value={current}
        onChange={(e) => {
          const clinic_id = e.target.value;
          void fetch("/api/demo/saas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "switch_clinic", data: { clinic_id } }),
          }).then(() => {
            setCurrent(clinic_id);
            router.refresh();
          });
        }}
      >
        {items.map((c) => (
          <option key={c.clinic_id} value={c.clinic_id}>
            {c.clinic_name}
          </option>
        ))}
      </select>
    </label>
  );
}
