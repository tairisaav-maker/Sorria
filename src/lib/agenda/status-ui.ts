import type { AppointmentStatus } from "@/types/agenda";

/** Cores semânticas — sempre acompanhar de texto/label. */
export const appointmentStatusTone: Record<
  AppointmentStatus,
  "info" | "success" | "neutral" | "warning" | "danger"
> = {
  scheduled: "info",
  confirmed: "success",
  arrived: "neutral",
  in_progress: "warning",
  completed: "success",
  no_show: "danger",
  cancelled: "neutral",
};

export const appointmentStatusDotClass: Record<AppointmentStatus, string> = {
  scheduled: "bg-sky-500",
  confirmed: "bg-emerald-500",
  arrived: "bg-violet-500",
  in_progress: "bg-orange-500",
  completed: "bg-emerald-700",
  no_show: "bg-red-500",
  cancelled: "bg-zinc-400",
};
