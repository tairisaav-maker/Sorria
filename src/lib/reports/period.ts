import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import type { ReportPeriod, ReportPeriodPreset } from "@/types/reports";
import { PERIOD_PRESET_LABELS } from "@/types/reports";

export const DEFAULT_CLINIC_TZ = "America/Sao_Paulo";

/** Parts of an instant in a given IANA timezone. */
function zonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function clinicTodayYmd(timeZone: string, now = new Date()): string {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * UTC instant of local midnight for YYYY-MM-DD in clinic timezone.
 */
export function zonedStartOfDay(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  // Initial guess: treat as UTC midnight then correct by offset
  let guess = new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0));
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(guess, timeZone);
    const asLocalMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const desiredLocalMs = Date.UTC(y!, m! - 1, d!, 0, 0, 0);
    const delta = desiredLocalMs - asLocalMs;
    if (delta === 0) break;
    guess = new Date(guess.getTime() + delta);
  }
  return guess;
}

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function ymdAddMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1 + months, Math.min(d!, 28)));
  // clamp to month length via day 1 + original day
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d!, last);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function startOfMonthYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function startOfYearYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}-01-01`;
}

function endOfMonthYmd(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function endOfYearYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}-12-31`;
}

function formatYmdBr(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Resolve period as half-open interval [start, end) in UTC,
 * interpreting calendar days in the clinic timezone.
 */
export function resolveReportPeriod(input: {
  preset: ReportPeriodPreset;
  customStart?: string | null;
  customEnd?: string | null;
  timeZone?: string;
  now?: Date;
}): ReportPeriod {
  const timeZone = input.timeZone || DEFAULT_CLINIC_TZ;
  const today = clinicTodayYmd(timeZone, input.now ?? new Date());

  let startYmd: string;
  let endInclusiveYmd: string;
  let label: string;

  switch (input.preset) {
    case "7d":
      startYmd = ymdAddDays(today, -6);
      endInclusiveYmd = today;
      label = PERIOD_PRESET_LABELS["7d"];
      break;
    case "30d":
      startYmd = ymdAddDays(today, -29);
      endInclusiveYmd = today;
      label = PERIOD_PRESET_LABELS["30d"];
      break;
    case "month":
      startYmd = startOfMonthYmd(today);
      endInclusiveYmd = endOfMonthYmd(today);
      label = PERIOD_PRESET_LABELS.month;
      break;
    case "6m":
      startYmd = startOfMonthYmd(ymdAddMonths(today, -5));
      endInclusiveYmd = today;
      label = PERIOD_PRESET_LABELS["6m"];
      break;
    case "year":
      startYmd = startOfYearYmd(today);
      endInclusiveYmd = endOfYearYmd(today);
      label = PERIOD_PRESET_LABELS.year;
      break;
    case "custom": {
      startYmd = input.customStart || today;
      endInclusiveYmd = input.customEnd || today;
      if (startYmd > endInclusiveYmd) {
        const tmp = startYmd;
        startYmd = endInclusiveYmd;
        endInclusiveYmd = tmp;
      }
      label = `${formatYmdBr(startYmd)} – ${formatYmdBr(endInclusiveYmd)}`;
      break;
    }
    default:
      startYmd = ymdAddDays(today, -29);
      endInclusiveYmd = today;
      label = PERIOD_PRESET_LABELS["30d"];
  }

  const start = zonedStartOfDay(startYmd, timeZone);
  const end = zonedStartOfDay(ymdAddDays(endInclusiveYmd, 1), timeZone);

  return {
    preset: input.preset,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    timezone: timeZone,
  };
}

/** Previous period of equal duration ending at current start. */
export function previousEquivalentPeriod(period: ReportPeriod): ReportPeriod {
  const start = new Date(period.start);
  const end = new Date(period.end);
  const ms = end.getTime() - start.getTime();
  return {
    preset: "custom",
    start: new Date(start.getTime() - ms).toISOString(),
    end: start.toISOString(),
    label: "Período anterior",
    timezone: period.timezone,
  };
}

export function inPeriod(iso: string | null | undefined, period: ReportPeriod): boolean {
  if (!iso) return false;
  const t = +new Date(iso);
  return t >= +new Date(period.start) && t < +new Date(period.end);
}

export function autoGranularity(period: ReportPeriod): "day" | "week" | "month" {
  const days = differenceInCalendarDays(new Date(period.end), new Date(period.start));
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

export function bucketKey(
  iso: string,
  granularity: "day" | "week" | "month",
  timeZone: string,
): string {
  const p = zonedParts(new Date(iso), timeZone);
  const ymd = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  if (granularity === "day") return ymd;
  if (granularity === "month") return ymd.slice(0, 7);
  // week starting Monday (clinic calendar)
  const utcGuess = zonedStartOfDay(ymd, timeZone);
  const local = zonedParts(utcGuess, timeZone);
  const asDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const day = asDate.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return ymdAddDays(ymd, mondayOffset);
}

export function bucketLabel(key: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") {
    const [y, m] = key.split("-");
    return `${m}/${y}`;
  }
  const [, m, d] = key.split("-");
  if (granularity === "week") return `Sem ${d}/${m}`;
  return `${d}/${m}`;
}

void format;
void startOfDay;
void startOfMonth;
void startOfYear;
void subDays;
void subMonths;
void addDays;
