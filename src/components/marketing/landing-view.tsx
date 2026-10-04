"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/marketing/faq-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { trackCommercialEvent } from "@/lib/commercial/client";

function trackCta(cta: string, href: string) {
  void trackCommercialEvent("cta_clicked", { meta: { cta, href } });
}

export function LandingView() {
  useEffect(() => {
    void trackCommercialEvent("landing_viewed");
  }, []);

  return (
    <main className="login-atmosphere min-h-dvh">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <SiteHeader />

        {/* HERO — brand + one headline + one sentence + CTAs */}
        <section className="relative min-h-[72dvh] pb-16 pt-10 sm:pt-16">
          <p className="animate-fade-in font-[family-name:var(--font-display)] text-5xl font-semibold tracking-[-0.03em] text-[var(--brand-ink)] sm:text-6xl md:text-7xl">
            Sorria
          </p>
          <p className="mt-2 animate-fade-in text-base font-medium text-[var(--text-muted)] sm:text-lg">
            Gestão inteligente para consultórios
          </p>
          <h1 className="mt-8 max-w-2xl animate-rise font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[var(--brand-ink)] sm:text-4xl md:text-5xl">
            Saiba quanto cada procedimento realmente custa.
          </h1>
          <p className="mt-5 max-w-xl animate-rise text-lg leading-relaxed text-[var(--text-muted)] [animation-delay:80ms]">
            O Sorria conecta seus procedimentos aos materiais utilizados,
            estoque, custos e financeiro do consultório — sem complicar sua
            rotina.
          </p>
          <div className="mt-9 flex flex-wrap gap-3 animate-rise [animation-delay:140ms]">
            <Link
              href="/conhecer"
              onClick={() => trackCta("hero_primary", "/conhecer")}
            >
              <Button size="lg">Quero conhecer o Sorria</Button>
            </Link>
            <Link
              href="/como-funciona"
              onClick={() => trackCta("hero_secondary", "/como-funciona")}
            >
              <Button size="lg" variant="secondary">
                Ver como funciona
              </Button>
            </Link>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 bottom-0 hidden h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.22),transparent_70%)] sm:block md:h-72 md:w-72"
          />
        </section>

        {/* PROBLEMA */}
        <section id="produto" className="scroll-mt-20 py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Você sabe quanto um procedimento realmente custa?
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--text-muted)] leading-relaxed">
            Você sabe quanto cobra por uma restauração. Mas sabe exatamente
            quanto ela custa para o seu consultório?
          </p>
          <p className="mt-4 max-w-2xl text-[var(--text-muted)] leading-relaxed">
            Um procedimento não custa apenas o material mais óbvio. Pode
            envolver descartáveis, anestésicos, resina, adesivos,
            instrumentais, tempo clínico e custos da operação. O Sorria
            organiza essas informações para cada procedimento.
          </p>
        </section>

        {/* COMO FUNCIONA — fluxo */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Como funciona
          </h2>
          <p className="mt-2 text-[var(--text-muted)]">
            Agenda, pacientes, estoque, materiais e financeiro conectados em um
            só fluxo.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Cadastre o procedimento",
              "Defina os materiais normalmente utilizados",
              "Realize o atendimento",
              "Confirme o que realmente foi utilizado",
              "O Sorria atualiza o estoque e calcula o custo",
              "Compare custo, valor cobrado e recebimento",
            ].map((step, i) => (
              <li
                key={step}
                className="flex gap-3 border-l-2 border-[var(--brand-primary)]/40 pl-4"
              >
                <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--brand-primary)]">
                  {i + 1}
                </span>
                <span className="text-sm text-[var(--brand-ink)]">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <Link
              href="/como-funciona"
              className="text-sm font-medium text-[var(--brand-primary)] underline-offset-2 hover:underline"
            >
              Ver o fluxo completo →
            </Link>
          </div>
        </section>

        {/* EXEMPLO VISUAL */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Exemplo ilustrativo
          </h2>
          <p className="mt-2 text-sm text-[var(--text-subtle)]">
            Números demonstrativos — não representam um caso clínico real.
          </p>
          <div className="mt-6 max-w-md space-y-2 border-y border-[var(--border)] py-5 font-mono text-sm">
            <p className="font-sans font-medium text-[var(--brand-ink)]">
              Restauração — Dente 16
            </p>
            {[
              ["Resina utilizada", "0,42 g"],
              ["Anestésico", "2 un"],
              ["Outros materiais", "R$ —"],
              ["Custo dos materiais", "R$ 32"],
              ["Custo operacional", "R$ 142"],
              ["Valor cobrado", "R$ 300"],
              ["Recebido", "R$ 200"],
              ["A receber", "R$ 100"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-[var(--text-muted)]">
                <span>{k}</span>
                <span className="text-[var(--brand-ink)]">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ESTOQUE */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            O estoque passa a conversar com a Agenda.
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--text-muted)] leading-relaxed">
            Com os procedimentos previstos dos próximos pacientes, o Sorria
            consegue estimar quanto material será necessário e indicar o que
            pode faltar.
          </p>
          <div className="mt-6 max-w-sm space-y-2 border-y border-[var(--border)] py-5 text-sm">
            <p className="font-medium text-[var(--brand-ink)]">Resina A2</p>
            <p className="text-[var(--text-muted)]">
              Estoque: <span className="text-[var(--brand-ink)]">4,2 g</span>
            </p>
            <p className="text-[var(--text-muted)]">
              Necessidade próximos 7 dias:{" "}
              <span className="text-[var(--brand-ink)]">6,8 g</span>
            </p>
            <p className="font-medium text-[var(--warning)]">
              Situação: Reposição necessária
            </p>
          </div>
        </section>

        {/* PROCEDIMENTO */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Da ficha técnica ao consumo real.
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--text-muted)] leading-relaxed">
            Compare o que normalmente deveria ser usado com o que realmente foi
            utilizado no atendimento.
          </p>
          <div className="mt-6 flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-[var(--text-subtle)]">Previsto</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                0,30 g
              </p>
            </div>
            <div>
              <p className="text-[var(--text-subtle)]">Utilizado</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                0,42 g
              </p>
            </div>
          </div>
        </section>

        {/* FINANCEIRO */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Cobrado não é recebido.
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--text-muted)]">
            Entenda seus custos e resultados operacionais — sem confundir com
            lucro contábil.
          </p>
          <div className="mt-6 flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-[var(--text-subtle)]">Cobrado</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                R$ 500
              </p>
            </div>
            <div>
              <p className="text-[var(--text-subtle)]">Recebido</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                R$ 300
              </p>
            </div>
            <div>
              <p className="text-[var(--text-subtle)]">Saldo</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                R$ 200
              </p>
            </div>
          </div>
        </section>

        {/* PARA QUEM É */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Feito para quem administra o próprio consultório.
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "Dentista autônomo",
                d: "Compra materiais, define preços e acompanha pagamentos.",
              },
              {
                t: "Consultório pequeno",
                d: "1 a 5 profissionais com rotina enxuta.",
              },
              {
                t: "Clínica em crescimento",
                d: "Quer clareza de custo sem ERP pesado.",
              },
            ].map((item) => (
              <li key={item.t} className="border-t border-[var(--border)] pt-4">
                <p className="font-medium text-[var(--brand-ink)]">{item.t}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{item.d}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* SIMPLICIDADE */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Gestão sem virar um ERP complicado.
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--text-muted)] leading-relaxed">
            Poucos cliques, interface clara, no celular, tablet e desktop —
            com dados conectados do procedimento ao financeiro.
          </p>
        </section>

        {/* CADEIA DIFERENCIAL */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            O diferencial em uma cadeia
          </h2>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--brand-ink)]">
            {[
              "Procedimento",
              "Materiais",
              "Estoque",
              "Custo real",
              "Preço cobrado",
              "Recebimento",
            ].map((step, i, arr) => (
              <span key={step} className="inline-flex items-center gap-2">
                {step}
                {i < arr.length - 1 ? (
                  <span className="text-[var(--brand-primary)]" aria-hidden>
                    →
                  </span>
                ) : null}
              </span>
            ))}
          </p>
        </section>

        {/* PROBLEMAS SECUNDÁRIOS */}
        <section className="py-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            O que o Sorria organiza
          </h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2">
            {[
              {
                t: "Estoque",
                d: "Descobrir material faltando perto do atendimento.",
              },
              {
                t: "Custos",
                d: "Saber quanto está sendo utilizado em cada procedimento.",
              },
              {
                t: "Preço",
                d: "Cobrar com mais clareza sobre a margem operacional.",
              },
              {
                t: "Financeiro",
                d: "Separar o que foi cobrado do que realmente foi recebido.",
              },
              {
                t: "Gestão",
                d: "Informações conectadas entre Agenda, estoque e financeiro.",
              },
            ].map((item) => (
              <li key={item.t}>
                <p className="font-medium text-[var(--brand-ink)]">{item.t}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{item.d}</p>
              </li>
            ))}
          </ul>
        </section>

        <FaqSection />

        {/* CTA FINAL */}
        <section className="py-16 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)] sm:text-3xl">
            Pronto para entender seus custos?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[var(--text-muted)]">
            Estamos em beta comercial com poucas clínicas. Suporte próximo,
            sem campanhas em massa.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/conhecer"
              onClick={() => trackCta("footer_primary", "/conhecer")}
            >
              <Button size="lg">Quero conhecer o Sorria</Button>
            </Link>
            <Link href="/planos" onClick={() => trackCta("footer_planos", "/planos")}>
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
