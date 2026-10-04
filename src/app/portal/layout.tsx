import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import { getPortalContext } from "@/services/portal";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    redirect("/login");
  }

  const jar = await cookies();
  const hydrated = hydrateDemoSessionFromCookie(
    jar.get(DEMO_COOKIE_NAME)?.value,
  );
  if (hydrated?.kind === "portal_revoked") {
    redirect("/login?next=/portal/inicio");
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
