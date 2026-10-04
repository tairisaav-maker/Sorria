import type { NavItem } from "@/types";

/**
 * Navegação principal — novo núcleo operacional.
 * Portal / Secretária Virtual despriorizados (acesso via Mais / flags).
 */
export const professionalNav: NavItem[] = [
  { href: "/app/home", label: "Início", icon: "home", enabled: true },
  { href: "/app/agenda", label: "Agenda", icon: "calendar", enabled: true },
  { href: "/app/pacientes", label: "Pacientes", icon: "users", enabled: true },
  { href: "/app/estoque", label: "Estoque", icon: "package", enabled: true },
  { href: "/app/financeiro", label: "Financeiro", icon: "wallet", enabled: true },
  { href: "/app/mais", label: "Mais", icon: "more", enabled: true },
];

/** Áreas secundárias (Mais / desktop). */
export const secondaryNav: NavItem[] = [
  { href: "/app/procedimentos", label: "Procedimentos", icon: "procedure", enabled: true },
  { href: "/app/relatorios", label: "Relatórios", icon: "more", enabled: true },
  { href: "/app/configuracoes", label: "Configurações", icon: "more", enabled: true },
];
