"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  FileText,
  Home,
  LogOut,
  UserRound,
  Wallet,
} from "lucide-react";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/portal/inicio", label: "Início", icon: Home },
  { href: "/portal/consultas", label: "Consultas", icon: CalendarDays },
  { href: "/portal/tratamento", label: "Tratamento", icon: Activity },
  { href: "/portal/prontuario", label: "Prontuário", icon: FileText },
  { href: "/portal/financeiro", label: "Financeiro", icon: Wallet },
] as const;

export function PortalShell({
  children,
  patientName,
  clinicName,
}: {
  children: ReactNode;
  patientName: string;
  clinicName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/auth/demo", { method: "DELETE" });
    router.replace("/login?next=/portal/inicio");
    router.refresh();
  }

  return (
    <div className="portal-atmosphere min-h-dvh bg-[var(--surface)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-elevated)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <SorriaMark size="sm" showSubtitle={false} />
          <div className="flex items-center gap-2">
            <Link
              href="/portal/perfil"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              aria-label="Perfil"
            >
              <UserRound className="size-4" />
              <span className="hidden sm:inline">{patientName.split(" ")[0]}</span>
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <p className="mx-auto max-w-3xl px-4 pb-2 text-xs text-[var(--text-subtle)]">
          {clinicName}
        </p>
        <nav
          className="mx-auto hidden max-w-3xl gap-1 px-2 pb-2 md:flex"
          aria-label="Portal"
        >
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium",
                  active
                    ? "bg-[var(--brand-primary)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-28 md:pb-10">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface-elevated)]/95 backdrop-blur md:hidden"
        aria-label="Navegação principal"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-5">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
                    active ? "text-[var(--brand-primary)]" : "text-[var(--text-subtle)]",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
