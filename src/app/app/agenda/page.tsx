import type { Metadata } from "next";
import { AgendaPageClient } from "@/components/agenda/agenda-page-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";
import { OWNER_A_ID } from "@/lib/demo/authz-store";
import { countPendingRequests } from "@/services/appointment-requests";
import { listClinicProfessionals } from "@/services/appointments";

export const metadata: Metadata = {
  title: "Agenda",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const params = await searchParams;
  const actor = await requirePermission("appointments.view");
  const professionals = listClinicProfessionals(actor.ctx);
  const defaultProfessionalId =
    professionals.find((p) => p.id === actor.ctx.userId)?.id ??
    professionals[0]?.id ??
    OWNER_A_ID;

  return (
    <AgendaPageClient
      canCreate={can(actor.ctx, "appointments.create").allowed}
      canUpdate={can(actor.ctx, "appointments.update").allowed}
      canCancel={can(actor.ctx, "appointments.cancel").allowed}
      pendingRequests={
        can(actor.ctx, "appointment_requests.view").allowed
          ? countPendingRequests(actor.ctx)
          : 0
      }
      professionals={professionals}
      defaultProfessionalId={defaultProfessionalId}
      initialPatientId={params.patientId}
    />
  );
}
