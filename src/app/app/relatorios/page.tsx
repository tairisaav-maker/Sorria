import type { Metadata } from "next";
import { ReportsClient } from "@/components/reports/reports-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Relatórios",
};

export default async function RelatoriosPage() {
  await requirePermission("reports.view");
  return <ReportsClient />;
}
