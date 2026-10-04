import { describe, expect, it } from "vitest";
import { rangesOverlap } from "@/lib/agenda/overlap";

describe("rangesOverlap half-open", () => {
  it("permite 10:00–11:00 e 11:00–12:00", () => {
    expect(
      rangesOverlap(
        "2026-10-04T10:00:00.000Z",
        "2026-10-04T11:00:00.000Z",
        "2026-10-04T11:00:00.000Z",
        "2026-10-04T12:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("nega 10:00–11:00 e 10:30–11:30", () => {
    expect(
      rangesOverlap(
        "2026-10-04T10:00:00.000Z",
        "2026-10-04T11:00:00.000Z",
        "2026-10-04T10:30:00.000Z",
        "2026-10-04T11:30:00.000Z",
      ),
    ).toBe(true);
  });

  it("nega 10:00–11:00 e 10:59–12:00", () => {
    expect(
      rangesOverlap(
        "2026-10-04T10:00:00.000Z",
        "2026-10-04T11:00:00.000Z",
        "2026-10-04T10:59:00.000Z",
        "2026-10-04T12:00:00.000Z",
      ),
    ).toBe(true);
  });
});
