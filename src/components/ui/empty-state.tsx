export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1 py-6">
      <p className="font-[family-name:var(--font-display)] text-lg text-[var(--text)]">
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-sm text-[var(--text-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
