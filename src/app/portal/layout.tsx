import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { getDemoSession } from "@/lib/demo/authz-store";
import { getPortalContext } from "@/services/portal";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    redirect("/login");
  }

  const session = getDemoSession();
  try {
    const ctx = getPortalContext({
      authUserId: session.userId,
      clinicId: session.clinicId,
      patientId: session.patientId,
    });
    return (
      <PortalShell patientName={ctx.patientName} clinicName={ctx.clinicName}>
        {children}
      </PortalShell>
    );
  } catch {
    redirect("/login?next=/portal/inicio");
  }
}
