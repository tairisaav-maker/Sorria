import { differenceInYears, isValid, parseISO } from "date-fns";

export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const date =
    birthDate.length === 10 && !birthDate.includes("T")
      ? parseISO(`${birthDate}T12:00:00`)
      : parseISO(birthDate);
  if (!isValid(date)) return null;
  return differenceInYears(new Date(), date);
}

export function isMinor(birthDate: string | null | undefined): boolean {
  const age = calcAge(birthDate);
  return age !== null && age < 18;
}
