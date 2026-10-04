import { describe, expect, it } from "vitest";
import { calcRegistrationCompletion } from "@/lib/patients/completion";
import type { Patient } from "@/types/patient";

describe("completude cadastral", () => {
  it("calcula percentual administrativo", () => {
    const result = calcRegistrationCompletion({
      full_name: "Ana",
      birth_date: "1990-01-01",
      phone: "11999999999",
      cpf: null,
      email: null,
      postal_code: null,
      street: null,
      city: null,
      state: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      guardian_name: null,
      guardian_phone: null,
      guardian_relationship: null,
    } as Patient);
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
    expect(result.guardianRequired).toBe(false);
  });

  it("exige responsável para menor", () => {
    const result = calcRegistrationCompletion({
      full_name: "João",
      birth_date: "2016-01-01",
      phone: null,
      cpf: null,
      email: null,
      postal_code: null,
      street: null,
      city: null,
      state: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      guardian_name: null,
      guardian_phone: null,
      guardian_relationship: null,
    } as Patient);
    expect(result.guardianRequired).toBe(true);
    expect(result.missing).toContain("guardian");
  });
});
