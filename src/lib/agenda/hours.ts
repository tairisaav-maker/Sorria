import { getClinic } from "@/lib/demo/authz-store";
import { getDemoSession } from "@/lib/demo/authz-store";
import type { ClinicHoursConfig, WeekdayKey } from "@/types/clinic-settings";
import { defaultClinicHours } from "@/types/clinic-settings";

/**
 * Horário de funcionamento da clínica ativa (ou default).
 * Suporta clinic hours + disponibilidade futura por profissional.
 */
export const DEFAULT_CLINIC_HOURS = {
  startHour: 8,
  endHour: 18,
  slotMinutes: 30,
  timezoneFallback: "America/Sao_Paulo",
} as const;

const WEEKDAY_BY_JS: WeekdayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export function getClinicHours(clinicId?: string) {
  const id = clinicId ?? getDemoSession().clinicId;
  const clinic = getClinic(id);
  const hours = clinic?.hours ?? defaultClinicHours();
  const slotMinutes = clinic?.slot_minutes ?? DEFAULT_CLINIC_HOURS.slotMinutes;
  const bounds = dayBounds(hours);
  return {
    startHour: bounds.startHour,
    endHour: bounds.endHour,
    slotMinutes,
    timezoneFallback: clinic?.timezone ?? DEFAULT_CLINIC_HOURS.timezoneFallback,
    hours,
  };
}

function dayBounds(hours: ClinicHoursConfig) {
  let startHour = 8;
  let endHour = 18;
  let min = 24;
  let max = 0;
  for (const day of Object.values(hours)) {
    if (!day.enabled) continue;
    for (const p of day.periods) {
      const s = Number(p.start.slice(0, 2));
      const e = Number(p.end.slice(0, 2));
      if (Number.isFinite(s)) min = Math.min(min, s);
      if (Number.isFinite(e)) max = Math.max(max, e);
    }
  }
  if (min < 24) startHour = min;
  if (max > 0) endHour = max;
  return { startHour, endHour };
}

export function isClinicOpenOn(date: Date, clinicId?: string) {
  const { hours } = getClinicHours(clinicId);
  const key = WEEKDAY_BY_JS[date.getDay()]!;
  return hours[key]?.enabled ?? false;
}

export function buildDaySlots(date: Date, clinicId?: string): Date[] {
  const { startHour, endHour, slotMinutes, hours } = getClinicHours(clinicId);
  const key = WEEKDAY_BY_JS[date.getDay()]!;
  const dayHours = hours[key];
  if (dayHours && !dayHours.enabled) return [];

  const slots: Date[] = [];
  if (dayHours?.periods?.length) {
    for (const period of dayHours.periods) {
      const [sh, sm] = period.start.split(":").map(Number);
      const [eh, em] = period.end.split(":").map(Number);
      const cursor = new Date(date);
      cursor.setHours(sh!, sm ?? 0, 0, 0);
      const end = new Date(date);
      end.setHours(eh!, em ?? 0, 0, 0);
      for (
        let t = new Date(cursor);
        t < end;
        t = new Date(t.getTime() + slotMinutes * 60_000)
      ) {
        slots.push(new Date(t));
      }
    }
    return slots;
  }

  const day = new Date(date);
  day.setHours(startHour, 0, 0, 0);
  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);
  for (
    let cursor = new Date(day);
    cursor < end;
    cursor = new Date(cursor.getTime() + slotMinutes * 60_000)
  ) {
    slots.push(new Date(cursor));
  }
  return slots;
}
