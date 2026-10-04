import type { Metadata } from "next";
import { PortalFinanceClient } from "@/components/portal/portal-finance-client";

export const metadata: Metadata = { title: "Financeiro — Portal" };

export default function PortalFinanceiroPage() {
  return <PortalFinanceClient />;
}
