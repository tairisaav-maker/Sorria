import {
  CalendarDays,
  CircleEllipsis,
  Home,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/types";

const icons: Record<NavItem["icon"], LucideIcon> = {
  home: Home,
  calendar: CalendarDays,
  users: Users,
  wallet: Wallet,
  assistant: Sparkles,
  more: CircleEllipsis,
};

export function NavIcon({
  name,
  className,
}: {
  name: NavItem["icon"];
  className?: string;
}) {
  const Icon = icons[name];
  return <Icon className={className} aria-hidden />;
}
