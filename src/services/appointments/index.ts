export { checkAvailability } from "@/services/appointments/availability";
export {
  countTodayAppointments,
  getAppointment,
  getPatientLastAppointment,
  getPatientNextAppointment,
  listAppointments,
  listAppointmentsForPatient,
  rangeForView,
} from "@/services/appointments/queries";
export {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  listClinicProfessionals,
  rescheduleAppointment,
} from "@/services/appointments/mutations";
