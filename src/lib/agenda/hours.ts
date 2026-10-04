/**
 * Horário de funcionamento default da clínica.
 * Preparado para configuração futura via clinics.settings — não hardcode na UI.
 */
export const DEFAULT_CLINIC_HOURS = {
  startHour: 8,
  endHour: 18,
  slotMinutes: 30,
  timezoneFallback: "America/Sao_Paulo",
} as const;

export function getClinicHours() {
  return DEFAULT_CLINIC_HOURS;
}

export function buildDaySlots(date: Date): Date[] {
  const { startHour, endHour, slotMinutes } = getClinicHours();
  const slots: Date[] = [];
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
