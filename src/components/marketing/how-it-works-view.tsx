"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { trackCommercialEvent } from "@/lib/commercial/client";

const FLOW = [
  {
    title: "Agenda",
    text: "Organize os atendimentos e veja o que está previsto para cada paciente.",
  },
  {
    title: "Paciente",
    text: "Abra o atendimento a partir da consulta — sem retrabalho.",
  },
  {
    title: "Procedimento",
    text: "Registre o que foi realizado com base na ficha técnica do consultório.",
  },
  {
    title: "Materiais",
    text: "Confirme o previsto e ajuste o que realmente foi utilizado.",
  },
  {
    title: "Estoque",
    text: "A baixa acontece após a confirmação — e a Agenda ajuda a prever necessidade.",
  },
  {
    title: "Custo",
    text: "O Sorria calcula o custo dos materiais e o custo operacional estimado.",
  },
  {
    title: "Financeiro",
    text: "Compare valor cobrado, recebido e o que ainda falta receber.",
  },
] as const;

export function HowItWorksView() {
  useEffect(() => {
    void trackCommercialEvent("how_it_works_viewed");
  }, []);

  return (
    <main className="login-atmosphere min-h-dvh">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <SiteHeader />
        <section className="py-12 sm:py-16">
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)] sm:text-4xl">
            Como funciona
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--text-muted)]">
            Um fluxo contínuo: do agendamento ao recebimento, passando por
            materiais, estoque e custo real.
          </p>

          <ol className="mt-12 space-y-0">
            {FLOW.map((step, i) => (
              <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0">
                {i < FLOW.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-8 bottom-0 w-px bg-[var(--border)]"
                  />
                ) : null}
                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-10 text-sm text-[var(--text-muted)]">
            Agenda → Paciente → Procedimento → Materiais → Estoque → Custo →
            Financeiro
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/conhecer">
              <Button size="lg">Quero conhecer o Sorria</Button>
            </Link>
            <Link href="/planos">
              <Button size="lg" variant="secondary">
                Ver planos
              </Button>
            </Link>
          </div>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
