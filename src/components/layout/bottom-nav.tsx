"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/layout/nav-icon";
import { professionalNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface-elevated)]/95 backdrop-blur-md lg:hidden"
      aria-label="Navegação móvel"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {professionalNav.map((item) => {
          const active = pathname.startsWith(item.href);
          const content = (
            <>
              <NavIcon
                name={item.icon}
                className={cn(
                  "size-5 transition-transform duration-200",
                  active && item.enabled && "scale-105",
                )}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </>
          );

          return (
            <li key={item.href}>
              {item.enabled ? (
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 transition-colors duration-200",
                    active
                      ? "text-[var(--brand-primary)]"
                      : "text-[var(--text-subtle)]",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <span
                  className="flex min-h-14 cursor-not-allowed flex-col items-center justify-center gap-1 text-[var(--text-subtle)] opacity-50"
                  aria-disabled="true"
                  title="Disponível em fases futuras"
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
