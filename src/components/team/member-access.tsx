import { ACCESS_GROUPS } from "@/lib/permissions/labels";
import {
  permissionsForRole,
  type DemoMembership,
} from "@/lib/demo/authz-store";
import { ROLE_LABELS } from "@/lib/permissions/keys";

export function MemberAccess({
  name,
  membership,
}: {
  name: string;
  membership: DemoMembership;
}) {
  const granted = new Set(permissionsForRole(membership.role_key));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
          Acesso de {name.split(" ")[0]}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Função:{" "}
          <span className="font-medium text-[var(--text)]">
            {ROLE_LABELS[membership.role_key]}
          </span>
        </p>
      </div>

      {ACCESS_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--brand-ink)]">
            {group.title}
          </h3>
          <ul className="space-y-1.5">
            {group.items.map((item) => {
              const ok = granted.has(item.key);
              return (
                <li
                  key={item.key}
                  className="flex items-center gap-2 text-sm text-[var(--text-muted)]"
                >
                  <span
                    className={
                      ok ? "text-[var(--success)]" : "text-[var(--text-subtle)]"
                    }
                    aria-hidden
                  >
                    {ok ? "✓" : "—"}
                  </span>
                  <span className={ok ? "text-[var(--text)]" : undefined}>
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {membership.role_key === "secretary" ? (
        <p className="rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
          A secretária não possui acesso ao prontuário clínico por padrão.
          Cadastro administrativo ≠ prontuário clínico.
        </p>
      ) : null}
    </div>
  );
}
