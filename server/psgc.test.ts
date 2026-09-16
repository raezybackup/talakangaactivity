import { describe, expect, it } from "vitest";
import { calculateAge } from "../client/src/lib/psgc";

describe("calculateAge", () => {
  it("calculates age before and after the birthday", () => {
    expect(calculateAge("2000-09-17", new Date("2026-09-16T12:00:00Z"))).toBe(25);
    expect(calculateAge("2000-09-17", new Date("2026-09-17T12:00:00Z"))).toBe(26);
  });

  it("returns null for an empty or future date", () => {
    expect(calculateAge("")).toBeNull();
    expect(calculateAge("2030-01-01", new Date("2026-09-16T12:00:00Z"))).toBeNull();
  });
});
