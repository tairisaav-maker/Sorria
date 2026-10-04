import type { NavItem } from "@/types";

/** Fase 1: Início + Mais (equipe/permissões). Agenda/pacientes/financeiro futuros. */
export const professionalNav: NavItem[] = [
  { href: "/app/home", label: "Início", icon: "home", enabled: true },
  { href: "/app/agenda", label: "Agenda", icon: "calendar", enabled: false },
  { href: "/app/pacientes", label: "Pacientes", icon: "users", enabled: false },
  { href: "/app/financeiro", label: "Financeiro", icon: "wallet", enabled: false },
  { href: "/app/mais", label: "Mais", icon: "more", enabled: true },
];
