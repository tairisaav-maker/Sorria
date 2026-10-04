import type { Metadata } from "next";
import { OperationalReportsClient } from "@/components/reports/operational-reports-client";
import { ReportsClient } from "@/components/reports/reports-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Relatórios",
};

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string }>;
}) {
  await requirePermission("reports.view");
  const params = await searchParams;
  if (params.classic === "1") {
    return <ReportsClient />;
  }
  return <OperationalReportsClient />;
}
