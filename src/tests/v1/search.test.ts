import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  OWNER_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import { globalSearch } from "@/lib/search/global";
import { createPatient } from "@/services/patients";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetPatientsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("busca global V1", () => {
  it("exige ao menos 2 caracteres", () => {
    expect(globalSearch(ownerA, "a")).toEqual([]);
  });

  it("encontra paciente por nome", () => {
    createPatient(ownerA, {
      full_name: "Busca Ana Clara",
      status: "active",
      acknowledge_duplicate: true,
    } as never);
    const hits = globalSearch(ownerA, "ana clara");
    expect(hits.some((h) => h.type === "patient" && h.label.includes("Ana"))).toBe(
      true,
    );
  });

  it("encontra procedimento e item de estoque", () => {
    expect(
      globalSearch(ownerA, "profilaxia").some((h) => h.type === "procedure"),
    ).toBe(true);
    expect(
      globalSearch(ownerA, "luva").some((h) => h.type === "inventory"),
    ).toBe(true);
  });
});
