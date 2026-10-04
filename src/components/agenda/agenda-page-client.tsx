"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppointmentDetail } from "@/components/agenda/appointment-detail";
import { AppointmentFormModal } from "@/components/agenda/appointment-form-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { buildDaySlots } from "@/lib/agenda/hours";
import { appointmentStatusDotClass } from "@/lib/agenda/status-ui";
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentWithPatient,
} from "@/types/agenda";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";
type Professional = { id: string; full_name: string };

function detectDefaultView(): ViewMode {
  if (typeof window === "undefined") return "week";
  const saved = window.localStorage.getItem("sorria.agenda.view") as ViewMode | null;
  if (saved === "day" || saved === "week" || saved === "month") return saved;
  return window.innerWidth < 768 ? "day" : "week";
}

export function AgendaPageClient({
  canCreate,
  canUpdate,
  canCancel,
  canOpenClinical,
  pendingRequests,
  professionals,
  defaultProfessionalId,
  initialPatientId,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canCancel: boolean;
  canOpenClinical?: boolean;
  pendingRequests: number;
  professionals: Professional[];
  defaultProfessionalId: string;
  initialPatientId?: string;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>("week");
  const [professionalId, setProfessionalId] = useState<"all" | string>("all");
  const [items, setItems] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AppointmentWithPatient | null>(null);
  const [createOpen, setCreateOpen] = useState(Boolean(initialPatientId));
  const [createStart, setCreateStart] = useState<Date | undefined>();

  useEffect(() => {
    setView(detectDefaultView());
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sorria.agenda.view", view);
  }, [view]);

  const range = useMemo(() => {
    if (view === "day") {
      const from = new Date(anchor);
      from.setHours(0, 0, 0, 0);
      const to = new Date(anchor);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    if (view === "week") {
      return {
        from: startOfWeek(anchor, { weekStartsOn: 1 }),
        to: endOfWeek(anchor, { weekStartsOn: 1 }),
      };
    }
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }, [anchor, view]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      professionalId,
    });
    const response = await fetch(`/api/demo/appointments?${params}`);
    const data = (await response.json()) as { items?: AppointmentWithPatient[] };
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from.toISOString(), range.to.toISOString(), professionalId]);

  const weekDays = eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  });

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
  });

  function openCreate(at?: Date) {
    setCreateStart(at ?? new Date());
    setCreateOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
            Agenda
          </h1>
          {pendingRequests > 0 ? (
            <Link
              href="/app/solicitacoes"
              className="mt-2 inline-flex text-sm font-medium text-[var(--brand-primary)]"
            >
              {pendingRequests} solicitações pendentes
            </Link>
          ) : null}
        </div>
        {canCreate ? (
          <Button type="button" onClick={() => openCreate()}>
            <Plus className="size-4" />
            Nova consulta
          </Button>
        ) : null}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
          Hoje
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Anterior"
          onClick={() =>
            setAnchor((d) =>
              view === "month" ? addMonths(d, -1) : addDays(d, view === "week" ? -7 : -1),
            )
          }
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Próximo"
          onClick={() =>
            setAnchor((d) =>
              view === "month" ? addMonths(d, 1) : addDays(d, view === "week" ? 7 : 1),
            )
          }
        >
          <ChevronRight className="size-4" />
        </Button>
        <p className="min-w-40 text-sm font-medium capitalize text-[var(--text)]">
          {view === "day"
            ? format(anchor, "EEEE, d 'de' MMMM", { locale: ptBR })
            : view === "week"
              ? `${format(range.from, "d MMM", { locale: ptBR })} – ${format(range.to, "d MMM yyyy", { locale: ptBR })}`
              : format(anchor, "MMMM yyyy", { locale: ptBR })}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          {(["day", "week", "month"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={view === mode ? "primary" : "ghost"}
              onClick={() => setView(mode)}
            >
              {mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês"}
            </Button>
          ))}
          {professionals.length > 1 ? (
            <Select
              aria-label="Filtrar profissional"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="h-9 w-auto"
            >
              <option value="all">Todos os profissionais</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </section>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : null}

      {!loading && view === "day" ? (
        <DayView
          day={anchor}
          items={items}
          onSlot={openCreate}
          onSelect={setSelected}
          canCreate={canCreate}
        />
      ) : null}

      {!loading && view === "week" ? (
        <WeekView
          days={weekDays}
          items={items}
          onSlot={openCreate}
          onSelect={setSelected}
        />
      ) : null}

      {!loading && view === "month" ? (
        <MonthView
          days={monthDays}
          anchor={anchor}
          items={items}
          onSelectDay={(day) => {
            setAnchor(day);
            setView("day");
          }}
        />
      ) : null}

      {selected ? (
        <AppointmentDetail
          appointment={selected}
          canUpdate={canUpdate}
          canCancel={canCancel}
          canOpenClinical={canOpenClinical}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            setSelected(null);
            await load();
          }}
        />
      ) : null}

      <AppointmentFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialStart={createStart}
        presetPatientId={initialPatientId}
        professionals={professionals}
        defaultProfessionalId={defaultProfessionalId}
        onCreated={async () => {
          setCreateOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function DayView({
  day,
  items,
  onSlot,
  onSelect,
  canCreate,
}: {
  day: Date;
  items: AppointmentWithPatient[];
  onSlot: (d: Date) => void;
  onSelect: (a: AppointmentWithPatient) => void;
  canCreate: boolean;
}) {
  const slots = buildDaySlots(day);
  const dayItems = items.filter((a) => isSameDay(new Date(a.start_at), day));

  if (dayItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-5 py-10 text-center">
        <EmptyState title="Agenda livre neste dia" />
        {canCreate ? (
          <Button type="button" className="mt-4" onClick={() => onSlot(day)}>
            <Plus className="size-4" />
            Nova consulta
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {slots.map((slot) => {
        const slotItems = dayItems.filter((a) => {
          const start = new Date(a.start_at);
          return (
            start.getHours() === slot.getHours() &&
            start.getMinutes() === slot.getMinutes()
          );
        });
        return (
          <li key={slot.toISOString()} className="grid grid-cols-[64px_1fr] gap-3">
            <button
              type="button"
              className="pt-2 text-left text-xs text-[var(--text-subtle)] hover:text-[var(--brand-primary)]"
              onClick={() => onSlot(slot)}
            >
              {format(slot, "HH:mm")}
            </button>
            <div className="min-h-12 space-y-2 border-l border-[var(--border)] pl-3">
              {slotItems.length === 0 ? (
                <button
                  type="button"
                  className="block w-full rounded-xl border border-transparent px-2 py-2 text-left text-xs text-[var(--text-subtle)] hover:border-dashed hover:border-[var(--border)]"
                  onClick={() => onSlot(slot)}
                >
                  Livre
                </button>
              ) : (
                slotItems.map((item) => (
                  <AppointmentChip key={item.id} item={item} onClick={() => onSelect(item)} />
                ))
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function WeekView({
  days,
  items,
  onSlot,
  onSelect,
}: {
  days: Date[];
  items: AppointmentWithPatient[];
  onSlot: (d: Date) => void;
  onSelect: (a: AppointmentWithPatient) => void;
}) {
  const hours = buildDaySlots(days[0]!).filter((s) => s.getMinutes() === 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90">
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
      >
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="border-b border-l border-[var(--border)] px-2 py-2 text-center text-xs font-medium"
          >
            <div className="capitalize">{format(day, "EEE", { locale: ptBR })}</div>
            <div>{format(day, "d")}</div>
          </div>
        ))}
        {hours.map((hour) => (
          <div key={hour.toISOString()} className="contents">
            <div className="border-b border-[var(--border)] px-1 py-3 text-[10px] text-[var(--text-subtle)]">
              {format(hour, "HH:mm")}
            </div>
            {days.map((day) => {
              const slot = new Date(day);
              slot.setHours(hour.getHours(), 0, 0, 0);
              const cellItems = items.filter((a) => {
                const start = new Date(a.start_at);
                return isSameDay(start, day) && start.getHours() === hour.getHours();
              });
              return (
                <button
                  key={`${day.toISOString()}-${hour.getHours()}`}
                  type="button"
                  className="min-h-14 space-y-1 border-b border-l border-[var(--border)] p-1 text-left hover:bg-[var(--surface-muted)]/50"
                  onClick={() => {
                    if (cellItems[0]) onSelect(cellItems[0]);
                    else onSlot(slot);
                  }}
                >
                  {cellItems.map((item) => (
                    <AppointmentChip key={item.id} item={item} compact />
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({
  days,
  anchor,
  items,
  onSelectDay,
}: {
  days: Date[];
  anchor: Date;
  items: AppointmentWithPatient[];
  onSelectDay: (d: Date) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-2">
      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
        <div key={d} className="px-1 py-2 text-center text-xs font-medium text-[var(--text-subtle)]">
          {d}
        </div>
      ))}
      {days.map((day) => {
        const count = items.filter(
          (a) => isSameDay(new Date(a.start_at), day) && a.status !== "cancelled",
        ).length;
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDay(day)}
            className={cn(
              "min-h-20 rounded-xl p-2 text-left hover:bg-[var(--surface-muted)]",
              !isSameMonth(day, anchor) && "opacity-40",
            )}
          >
            <div className="text-xs font-medium">{format(day, "d")}</div>
            {count > 0 ? (
              <Badge tone="info" className="mt-2">
                {count}
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function AppointmentChip({
  item,
  onClick,
  compact,
}: {
  item: AppointmentWithPatient;
  onClick?: () => void;
  compact?: boolean;
}) {
  const content = (
    <>
      <span className={cn("mt-0.5 size-2 shrink-0 rounded-full", appointmentStatusDotClass[item.status])} />
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {format(new Date(item.start_at), "HH:mm")} {item.patient_name}
        </span>
        {!compact ? (
          <span className="block truncate text-[11px] text-[var(--text-muted)]">
            {item.reason || "Consulta"} · {APPOINTMENT_STATUS_LABELS[item.status]}
          </span>
        ) : null}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-2 rounded-xl bg-[var(--brand-soft)]/60 px-2 py-2 text-left text-xs"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-1 rounded-lg bg-[var(--brand-soft)]/50 px-1.5 py-1 text-[10px]">
      {content}
    </div>
  );
}
