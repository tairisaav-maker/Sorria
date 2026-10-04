import type { Metadata } from "next";
import { RequestsPageClient } from "@/components/requests/requests-page-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";
import { OWNER_A_ID } from "@/lib/demo/authz-store";
import { listClinicProfessionals } from "@/services/appointments";

export const metadata: Metadata = {
  title: "Solicitações",
};

export default async function SolicitacoesPage() {
  const actor = await requirePermission("appointment_requests.view");
  const professionals = listClinicProfessionals(actor.ctx);
  const defaultProfessionalId =
    professionals.find((p) => p.id === actor.ctx.userId)?.id ??
    professionals[0]?.id ??
    OWNER_A_ID;

  return (
    <RequestsPageClient
      canManage={can(actor.ctx, "appointment_requests.manage").allowed}
      professionals={professionals}
      defaultProfessionalId={defaultProfessionalId}
    />
  );
}
