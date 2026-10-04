export function HomeGreeting({
  userName,
  clinicName,
}: {
  userName: string;
  clinicName: string;
}) {
  const parts = userName.trim().split(/\s+/);
  const firstName =
    parts[0]?.toLowerCase().startsWith("dr") && parts[1]
      ? `${parts[0]} ${parts[1]}`
      : (parts[0] ?? userName);

  return (
    <section className="animate-fade-in">
      <p className="text-sm font-medium text-[var(--brand-primary)]">Início</p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)] sm:text-4xl">
        Bom te ver, {firstName}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)] sm:text-base">
        O que precisa da minha atenção hoje na {clinicName}?
      </p>
    </section>
  );
}
