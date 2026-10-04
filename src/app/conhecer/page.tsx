import type { Metadata } from "next";
import { LeadForm } from "@/components/marketing/lead-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Quero conhecer o Sorria",
  description:
    "Deixe seu interesse no beta comercial do Sorria. Conversamos sobre custo real de procedimentos no seu consultório.",
};

export default function ConhecerPage() {
  return (
    <main className="login-atmosphere min-h-dvh">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6">
        <SiteHeader />
        <section className="py-12">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
            Quero conhecer o Sorria
          </h1>
          <p className="mt-3 text-[var(--text-muted)]">
            Estamos em beta comercial com 5 a 10 clínicas. Conte um pouco sobre
            o seu consultório — retornamos para uma conversa ou demonstração.
          </p>
          <div className="mt-8">
            <LeadForm />
          </div>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
