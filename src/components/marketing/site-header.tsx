"use client";

import Link from "next/link";
import { useState } from "react";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { Button } from "@/components/ui/button";
import { trackCommercialEvent } from "@/lib/commercial/client";

const NAV = [
  { href: "/#produto", label: "Produto" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/planos", label: "Planos" },
] as const;

export function SiteHeader({
  primaryCta = { href: "/conhecer", label: "Quero conhecer o Sorria" },
}: {
  primaryCta?: { href: string; label: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 py-4">
      <Link href="/" className="shrink-0" aria-label="Sorria — início">
        <SorriaMark size="md" showSubtitle />
      </Link>

      <nav
        className="hidden items-center gap-6 text-sm font-medium text-[var(--text-muted)] md:flex"
        aria-label="Principal"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="transition-colors hover:text-[var(--brand-ink)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Link href="/login" className="hidden sm:block">
          <Button variant="ghost" size="sm">
            Entrar
          </Button>
        </Link>
        <Link
          href={primaryCta.href}
          onClick={() =>
            void trackCommercialEvent("cta_clicked", {
              meta: { cta: "header_primary", href: primaryCta.href },
            })
          }
        >
          <Button size="sm">{primaryCta.label}</Button>
        </Link>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--brand-ink)] md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden className="text-lg">
            {open ? "×" : "☰"}
          </span>
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          className="flex w-full flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/95 p-3 text-sm md:hidden animate-fade-in"
          aria-label="Mobile"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[var(--brand-ink)] hover:bg-[var(--surface-muted)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-[var(--text-muted)]"
            onClick={() => setOpen(false)}
          >
            Entrar
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
