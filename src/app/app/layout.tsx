import { AppShell } from "@/components/layout/app-shell";
import {
  getClinic,
  getDemoSession,
  getProfile,
} from "@/lib/demo/authz-store";

export default function ProfessionalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
