export {
  checkPotentialDuplicates,
  hasExactCpfDuplicate,
} from "@/services/patients/duplicates";
export {
  getPatient,
  listPatients,
  searchPatients,
  PAGE_SIZE,
} from "@/services/patients/queries";
export {
  archivePatient,
  createPatient,
  reactivatePatient,
  updatePatient,
} from "@/services/patients/mutations";
