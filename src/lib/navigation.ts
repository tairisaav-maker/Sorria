import type { NavItem } from "@/types";

/** Início + Agenda + Pacientes + Financeiro + Secretária + Mais. */
export const professionalNav: NavItem[] = [
  { href: "/app/home", label: "Início", icon: "home", enabled: true },
  { href: "/app/agenda", label: "Agenda", icon: "calendar", enabled: true },
  { href: "/app/pacientes", label: "Pacientes", icon: "users", enabled: true },
  { href: "/app/financeiro", label: "Financeiro", icon: "wallet", enabled: true },
  { href: "/app/assistente", label: "Secretária", icon: "assistant", enabled: true },
  { href: "/app/mais", label: "Mais", icon: "more", enabled: true },
];
