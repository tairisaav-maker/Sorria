import { describe, expect, it } from "vitest";
import {
  canTransitionAppointment,
  canTransitionRequest,
} from "@/lib/agenda/state-machines";

describe("state machine consulta", () => {
  it("permite fluxo principal", () => {
    expect(canTransitionAppointment("scheduled", "confirmed")).toBe(true);
    expect(canTransitionAppointment("confirmed", "arrived")).toBe(true);
    expect(canTransitionAppointment("arrived", "in_progress")).toBe(true);
    expect(canTransitionAppointment("in_progress", "completed")).toBe(true);
  });

  it("permite cancelamento e falta nos estados iniciais", () => {
    expect(canTransitionAppointment("scheduled", "cancelled")).toBe(true);
    expect(canTransitionAppointment("confirmed", "no_show")).toBe(true);
  });

  it("nega transições absurdas", () => {
    expect(canTransitionAppointment("cancelled", "in_progress")).toBe(false);
    expect(canTransitionAppointment("completed", "scheduled")).toBe(false);
    expect(canTransitionAppointment("no_show", "confirmed")).toBe(false);
  });
});

describe("state machine solicitação", () => {
  it("permite new → under_review → proposed → approved", () => {
    expect(canTransitionRequest("new", "under_review")).toBe(true);
    expect(canTransitionRequest("under_review", "proposed")).toBe(true);
    expect(canTransitionRequest("proposed", "approved")).toBe(true);
  });

  it("permite new → rejected e proposed → cancelled", () => {
    expect(canTransitionRequest("new", "rejected")).toBe(true);
    expect(canTransitionRequest("proposed", "cancelled")).toBe(true);
  });

  it("nega aprovada → proposed", () => {
    expect(canTransitionRequest("approved", "proposed")).toBe(false);
  });
});
