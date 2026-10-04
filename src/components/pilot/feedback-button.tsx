"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bug" | "friction" | "suggestion">("friction");
  const [what, setWhat] = useState("");
  const [expected, setExpected] = useState("");
  const [impact, setImpact] = useState<"none" | "some" | "much">("some");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          data: {
            kind,
            what_happened: what,
            what_expected: expected,
            impact,
            route: pathname,
          },
        }),
      });
      if (!res.ok) {
        setError("Não foi possível enviar. Tente de novo.");
        setBusy(false);
        return;
      }
      setDone(true);
      setWhat("");
      setExpected("");
      setBusy(false);
      window.setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 1200);
    } catch {
      setError("Não foi possível enviar. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--brand-ink)] shadow-md hover:bg-[var(--surface-muted)]/80 lg:bottom-6"
        aria-label="Enviar feedback"
      >
        <MessageCircle className="size-4" aria-hidden />
        <span className="hidden sm:inline">Enviar feedback</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
          >
            <h2
              id="feedback-title"
              className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]"
            >
              Feedback rápido
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Poucos segundos. Não inclua dados clínicos de pacientes.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="fb-kind">Tipo</Label>
              <select
                id="fb-kind"
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm"
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "bug" | "friction" | "suggestion")
                }
              >
                <option value="bug">Bug</option>
                <option value="friction">Dificuldade de uso</option>
                <option value="suggestion">Sugestão</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-what">O que aconteceu?</Label>
              <textarea
                id="fb-what"
                required
                rows={2}
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-expected">O que você esperava?</Label>
              <textarea
                id="fb-expected"
                required
                rows={2}
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm"
              />
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">
                Esta situação atrapalhou o atendimento?
              </legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {(
                  [
                    ["none", "Não"],
                    ["some", "Um pouco"],
                    ["much", "Muito"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="impact"
                      checked={impact === value}
                      onChange={() => setImpact(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {error ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            {done ? (
              <p className="text-sm text-[var(--success)]" role="status">
                Feedback enviado. Obrigada.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" size="sm" loading={busy}>
                Enviar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
