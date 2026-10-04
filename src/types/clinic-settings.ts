export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type DayPeriod = {
  start: string; // HH:mm
  end: string;
};

export type DayHours = {
  enabled: boolean;
  periods: DayPeriod[];
};

export type ClinicHoursConfig = Record<WeekdayKey, DayHours>;

export type OnboardingProgress = {
  welcome_seen: boolean;
  clinic_done: boolean;
  profile_done: boolean;
  hours_done: boolean;
  first_patient_done: boolean;
  first_appointment_done: boolean;
  dismissed: boolean;
  completed_at: string | null;
};

export type ClinicStatus = "active" | "suspended" | "closed";

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export const WEEKDAY_ORDER: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export function defaultClinicHours(): ClinicHoursConfig {
  const work: DayHours = {
    enabled: true,
    periods: [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
  };
  const off: DayHours = { enabled: false, periods: [] };
  return {
    mon: { ...work, periods: work.periods.map((p) => ({ ...p })) },
    tue: { ...work, periods: work.periods.map((p) => ({ ...p })) },
    wed: { ...work, periods: work.periods.map((p) => ({ ...p })) },
    thu: { ...work, periods: work.periods.map((p) => ({ ...p })) },
    fri: { ...work, periods: work.periods.map((p) => ({ ...p })) },
    sat: off,
    sun: off,
  };
}

export function defaultOnboarding(complete = false): OnboardingProgress {
  if (complete) {
    return {
      welcome_seen: true,
      clinic_done: true,
      profile_done: true,
      hours_done: true,
      first_patient_done: true,
      first_appointment_done: true,
      dismissed: false,
      completed_at: new Date().toISOString(),
    };
  }
  return {
    welcome_seen: false,
    clinic_done: false,
    profile_done: false,
    hours_done: false,
    first_patient_done: false,
    first_appointment_done: false,
    dismissed: false,
    completed_at: null,
  };
}

export function isOnboardingComplete(o: OnboardingProgress) {
  if (o.dismissed || o.completed_at) return true;
  return (
    o.clinic_done &&
    o.profile_done &&
    o.hours_done &&
    o.first_patient_done &&
    o.first_appointment_done
  );
}
