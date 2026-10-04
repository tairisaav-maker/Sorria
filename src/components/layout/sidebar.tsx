"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { NavIcon } from "@/components/layout/nav-icon";
import { professionalNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({ clinicName }: { clinicName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--border)] lg:bg-[var(--surface-elevated)]/80 lg:backdrop-blur-md">
      <div className="flex h-full flex-col px-5 py-6">
        <div className="animate-fade-in">
          <SorriaMark size="md" />
          <p className="mt-3 text-xs text-[var(--text-subtle)]">
            Clínica: <span className="text-[var(--text-muted)]">{clinicName}</span>
          </p>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Principal">
          {professionalNav.map((item) => {
            const active = pathname.startsWith(item.href);
            const classes = cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              item.enabled
                ? active
                  ? "bg-[var(--brand-soft)] text-[var(--brand-ink)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                : "cursor-not-allowed text-[var(--text-subtle)] opacity-60",
            );

            if (!item.enabled) {
              return (
                <span
                  key={item.href}
                  className={classes}
                  aria-disabled="true"
                  title="Disponível em fases futuras"
                >
                  <NavIcon name={item.icon} className="size-4.5" />
                  {item.label}
                </span>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={classes}>
                <NavIcon name={item.icon} className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <p className="text-xs text-[var(--text-subtle)]">
          Sorria — Fase 3
        </p>
      </div>
    </aside>
  );
}
