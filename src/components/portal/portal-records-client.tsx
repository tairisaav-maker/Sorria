"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RECORD_COPY_STATUS_LABELS } from "@/types/portal";

export function PortalRecordsClient() {
  const [docs, setDocs] = useState<
    Array<{ id: string; file_name: string; description: string | null; created_at: string; type: string }>
  >([]);
  const [copies, setCopies] = useState<
    Array<{ id: string; status: keyof typeof RECORD_COPY_STATUS_LABELS; requested_at: string }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [d, c] = await Promise.all([
      fetch("/api/demo/portal?resource=documents").then((r) => r.json()),
      fetch("/api/demo/portal?resource=copy-requests").then((r) => r.json()),
    ]);
    setDocs(d.items ?? []);
    setCopies(c.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Prontuário
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Informações e documentos liberados pela clínica.
        </p>
      </section>

      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Documentos</h2>
          <Link href="/portal/documentos" className="text-sm text-[var(--brand-primary)]">
            Ver todos
          </Link>
        </div>
        {docs.length === 0 ? (
          <EmptyState title="Nenhum documento disponível" />
        ) : (
          <ul className="mt-3 space-y-2">
            {docs.map((doc) => (
              <li key={doc.id} className="rounded-xl bg-[var(--surface-muted)]/60 px-3 py-2 text-sm">
                <p className="font-medium">{doc.file_name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {doc.description || doc.type} ·{" "}
                  {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1"
                  onClick={async () => {
                    const res = await fetch(`/api/demo/portal?resource=document&id=${doc.id}`);
                    const data = await res.json();
                    if (!res.ok) {
                      setMessage(data.error ?? "Este documento não está disponível.");
                      return;
                    }
                    setMessage(`Documento liberado para visualização: ${data.file_name}`);
                  }}
                >
                  Visualizar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg">
          Cópia do prontuário
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          A clínica preparará a cópia com revisão adequada.
        </p>
        <Button
          className="mt-3"
          type="button"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch("/api/demo/portal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "request-copy" }),
            });
            const data = await res.json();
            setBusy(false);
            setMessage(data.message ?? "Solicitação enviada.");
            await load();
          }}
        >
          Solicitar cópia do prontuário
        </Button>
        <ul className="mt-3 space-y-2 text-sm">
          {copies.map((c) => (
            <li key={c.id} className="text-[var(--text-muted)]">
              {RECORD_COPY_STATUS_LABELS[c.status]} ·{" "}
              {format(new Date(c.requested_at), "dd/MM/yyyy", { locale: ptBR })}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
