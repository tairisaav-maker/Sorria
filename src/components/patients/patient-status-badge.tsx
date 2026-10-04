import { Badge } from "@/components/ui/badge";
import {
  PATIENT_STATUS_LABELS,
  type PatientStatus,
} from "@/types/patient";

const tone: Record<PatientStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  inactive: "warning",
  archived: "neutral",
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  return (
    <Badge tone={tone[status]}>
      <span className="sr-only">Status: </span>
      {PATIENT_STATUS_LABELS[status]}
    </Badge>
  );
}
