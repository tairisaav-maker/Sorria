"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { PatientStatusBadge } from "@/components/patients/patient-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { calcAge } from "@/lib/patients/age";
import { formatPhoneBR } from "@/lib/patients/normalize";
import type {
  PatientListItem,
  PatientSort,
  PatientStatusFilter,
} from "@/types/patient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ListResponse = {
  items: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function PatientsListClient({
  canCreate,
}: {
  canCreate: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [status, setStatus] = useState<PatientStatusFilter>(
    (searchParams.get("status") as PatientStatusFilter) ?? "all",
  );
  const [sort, setSort] = useState<PatientSort>(
    (searchParams.get("sort") as PatientSort) ?? "name_asc",
  );
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q: debouncedQuery,
      status,
      sort,
      page: String(page),
    });

    startTransition(() => {
      router.replace(`/app/pacientes?${params.toString()}`, { scroll: false });
    });

    fetch(`/api/demo/patients?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = (await response.json()) as ListResponse & { error?: string };
        if (!response.ok) throw new Error(json.error ?? "Falha ao carregar");
        setData(json);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível concluir esta ação. Tente novamente.",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debouncedQuery, status, sort, page, router]);

  const empty = useMemo(
    () => !loading && data && data.items.length === 0,
    [loading, data],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <section className="animate-fade-in flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
            Pacientes
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Encontre e gerencie seus pacientes.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/app/pacientes/novo"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
          >
            <Plus className="size-4" />
            Novo paciente
          </Link>
        ) : null}
      </section>

      <section className="animate-rise grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-3 sm:grid-cols-[1fr_auto_auto] sm:p-4">
        <label className="relative block">
          <span className="sr-only">Buscar paciente</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, telefone ou CPF"
            className="pl-9"
            aria-label="Buscar paciente"
          />
        </label>
        <Select
          aria-label="Filtrar por status"
          value={status}
          onChange={(e) => setStatus(e.target.value as PatientStatusFilter)}
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="archived">Arquivados</option>
        </Select>
        <Select
          aria-label="Ordenar"
          value={sort}
          onChange={(e) => setSort(e.target.value as PatientSort)}
        >
          <option value="name_asc">Nome A–Z</option>
          <option value="name_desc">Nome Z–A</option>
          <option value="newest">Mais recentes</option>
          <option value="updated">Atualizados recentemente</option>
        </Select>
      </section>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando pacientes">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
            />
          ))}
        </div>
      ) : null}

      {empty && !debouncedQuery ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/80 px-5 py-10 text-center">
          <EmptyState
            title="Seus pacientes aparecerão aqui"
            description="Cadastre o primeiro paciente para começar."
          />
          {canCreate ? (
            <Link
              href="/app/pacientes/novo"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
            >
              <Plus className="size-4" />
              Novo paciente
            </Link>
          ) : null}
        </div>
      ) : null}

      {empty && debouncedQuery ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-5 py-8 text-center">
          <EmptyState
            title="Nenhum paciente encontrado"
            description="Confira o nome, telefone ou CPF."
          />
          {canCreate ? (
            <Link
              href="/app/pacientes/novo"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium"
            >
              Cadastrar novo paciente
            </Link>
          ) : null}
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <ul className="space-y-3 lg:hidden">
            {data.items.map((patient) => {
              const age = calcAge(patient.birth_date);
              return (
                <li
                  key={patient.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text)]">
                        {patient.full_name}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {formatPhoneBR(patient.phone) || "Sem telefone"}
                      </p>
                      <p className="text-xs text-[var(--text-subtle)]">
                        {age !== null ? `${age} anos` : "Idade não informada"}
                      </p>
                      <div className="mt-2">
                        <PatientStatusBadge status={patient.status} />
                      </div>
                    </div>
                    <Link
                      href={`/app/pacientes/${patient.id}`}
                      className="text-sm font-medium text-[var(--brand-primary)]"
                    >
                      Ver paciente
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)]/70 text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Idade</th>
                  <th className="px-4 py-3 font-medium">Última atualização</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.items.map((patient) => {
                  const age = calcAge(patient.birth_date);
                  return (
                    <tr key={patient.id}>
                      <td className="px-4 py-3 font-medium text-[var(--text)]">
                        {patient.full_name}
                        {patient.preferred_name ? (
                          <span className="block text-xs font-normal text-[var(--text-subtle)]">
                            {patient.preferred_name}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {formatPhoneBR(patient.phone) || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {age !== null ? `${age} anos` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {format(new Date(patient.updated_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <PatientStatusBadge status={patient.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/pacientes/${patient.id}`}
                          className="font-medium text-[var(--brand-primary)]"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-subtle)]">
              {data.total} paciente(s) · página {data.page} de {data.totalPages}
              {pending || loading ? (
                <Spinner className="ml-2 inline-block size-3 align-middle" />
              ) : null}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
