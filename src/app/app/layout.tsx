import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import {
  getClinic,
  getDemoSession,
  getProfile,
} from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";

export default async function ProfessionalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  hydrateDemoSessionFromCookie(jar.get(DEMO_COOKIE_NAME)?.value);

  const session = getDemoSession();
  const profile = getProfile(session.userId);
  const clinic = getClinic(session.clinicId);

  const userName = profile?.full_name ?? "Profissional";
  const clinicName = clinic?.name ?? "Clínica";

  return (
    <div className="app-canvas min-h-dvh">
      <AppShell userName={userName} clinicName={clinicName}>
        {children}
      </AppShell>
    </div>
  );
}
