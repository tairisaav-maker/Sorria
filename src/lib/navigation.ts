import type { NavItem } from "@/types";

/** Fase 3: Início + Agenda + Pacientes + Mais. */
export const professionalNav: NavItem[] = [
  { href: "/app/home", label: "Início", icon: "home", enabled: true },
  { href: "/app/agenda", label: "Agenda", icon: "calendar", enabled: true },
  { href: "/app/pacientes", label: "Pacientes", icon: "users", enabled: true },
  { href: "/app/financeiro", label: "Financeiro", icon: "wallet", enabled: false },
  { href: "/app/mais", label: "Mais", icon: "more", enabled: true },
];
