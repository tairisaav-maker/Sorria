import { DEFAULT_CLINIC_TZ, clinicTodayYmd, zonedStartOfDay } from "@/lib/reports/period";

function ymdAdd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function weekdayInTz(ymd: string, timeZone: string): number {
  // 0=Sun..6=Sat in clinic TZ
  const instant = zonedStartOfDay(ymd, timeZone);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[fmt.format(instant)] ?? 0;
}

/** Resolve natural language date expressions to absolute YMD in clinic TZ. */
export function resolveNaturalDate(
  text: string,
  timeZone = DEFAULT_CLINIC_TZ,
  now = new Date(),
): { ymd: string; label: string } | null {
  const t = text.toLowerCase();
  const today = clinicTodayYmd(timeZone, now);

  // Avoid \\b with accented PT-BR (ã/ç break JS word boundaries).
  if (/(^|[^a-zà-ú])hoje([^a-zà-ú]|$)/.test(t)) {
    return { ymd: today, label: formatLabel(today, timeZone) };
  }
  if (/(^|[^a-zà-ú])amanh[ãa]([^a-zà-ú]|$)/.test(t)) {
    const ymd = ymdAdd(today, 1);
    return { ymd, label: formatLabel(ymd, timeZone) };
  }
  if (/(^|[^a-zà-ú])ontem([^a-zà-ú]|$)/.test(t)) {
    const ymd = ymdAdd(today, -1);
    return { ymd, label: formatLabel(ymd, timeZone) };
  }

  const weekdays: Record<string, number> = {
    domingo: 0, "segunda": 1, "segunda-feira": 1,
    terca: 2, "terça": 2, "terça-feira": 2, "terca-feira": 2,
    quarta: 3, "quarta-feira": 3,
    quinta: 4, "quinta-feira": 4,
    sexta: 5, "sexta-feira": 5,
    sabado: 6, "sábado": 6,
  };

  for (const [name, target] of Object.entries(weekdays)) {
    if (t.includes(name)) {
      const current = weekdayInTz(today, timeZone);
      let delta = (target - current + 7) % 7;
      if (delta === 0 && !/\bhoje\b/.test(t)) delta = 7; // next occurrence
      if (/\bpr[oó]xim[ao]\b/.test(t) && delta === 0) delta = 7;
      const ymd = ymdAdd(today, delta);
      return { ymd, label: formatLabel(ymd, timeZone) };
    }
  }

  const iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return { ymd: iso[1]!, label: formatLabel(iso[1]!, timeZone) };

  const br = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (br) {
    const y = br[3] ?? today.slice(0, 4);
    const ymd = `${y}-${br[2]!.padStart(2, "0")}-${br[1]!.padStart(2, "0")}`;
    return { ymd, label: formatLabel(ymd, timeZone) };
  }

  return null;
}

export function dayRange(ymd: string, timeZone = DEFAULT_CLINIC_TZ) {
  const start = zonedStartOfDay(ymd, timeZone);
  const end = zonedStartOfDay(ymdAdd(ymd, 1), timeZone);
  return { start: start.toISOString(), end: end.toISOString(), ymd };
}

export function formatLabel(ymd: string, timeZone = DEFAULT_CLINIC_TZ): string {
  const d = zonedStartOfDay(ymd, timeZone);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function parseTimeHHMM(text: string): { hour: number; minute: number } | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*h?\b/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function isAfternoon(text: string) {
  return /\btarde\b/.test(text.toLowerCase());
}

export function isMorning(text: string) {
  return /\bmanh[ãa]\b/.test(text.toLowerCase());
}
