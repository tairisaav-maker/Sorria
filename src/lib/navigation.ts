import type { NavItem } from "@/types";

/** Fase 0: apenas Início habilitado. Demais rotas entram em fases futuras. */
export const professionalNav: NavItem[] = [
  { href: "/app/home", label: "Início", icon: "home", enabled: true },
  { href: "/app/agenda", label: "Agenda", icon: "calendar", enabled: false },
  { href: "/app/pacientes", label: "Pacientes", icon: "users", enabled: false },
  { href: "/app/financeiro", label: "Financeiro", icon: "wallet", enabled: false },
  { href: "/app/mais", label: "Mais", icon: "more", enabled: false },
];
