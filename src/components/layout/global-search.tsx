"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Hit = {
  type: string;
  id: string;
  label: string;
  href: string;
  subtitle?: string;
};

const typeLabel: Record<string, string> = {
  patient: "Paciente",
  procedure: "Procedimento",
  inventory: "Estoque",
};

export function GlobalSearch() {
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetch(`/api/demo/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          setHits(data.items ?? []);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <label className="sr-only" htmlFor="global-search">
        Buscar paciente, procedimento ou estoque
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]"
          aria-hidden
        />
        <input
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Buscar…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
        />
      </div>
      {open && hits.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg"
        >
          {hits.map((h) => (
            <li key={`${h.type}-${h.id}`} role="option" aria-selected={false}>
              <Link
                href={h.href}
                className="block px-3 py-2 text-sm hover:bg-[var(--surface-muted)]/70"
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="font-medium text-[var(--brand-ink)]">
                  {h.label}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                  {typeLabel[h.type] ?? h.type}
                  {h.subtitle ? ` · ${h.subtitle}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
