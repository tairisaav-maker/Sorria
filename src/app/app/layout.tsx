import { AppShell } from "@/components/layout/app-shell";
import { demoClinic, demoProfile } from "@/lib/mock/home";

export default function ProfessionalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userName = demoProfile.full_name ?? "Profissional";
  const clinicName = demoClinic.name;

  return (
    <div className="app-canvas min-h-dvh">
      <AppShell userName={userName} clinicName={clinicName}>
        {children}
      </AppShell>
    </div>
  );
}
