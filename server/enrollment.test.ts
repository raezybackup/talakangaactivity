import { afterEach, describe, expect, it, vi } from "vitest";
import { getCourseSubjectsForProgram, getLatestApprovedAdmission } from "./supabase";

describe("enrollment data access", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns an approved latest admission and preserves its program and campus links", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { admission_id: 18, applicant_id: 4, campus_id: 2, program_id: 7, previous_school: "North High", status: "Approved" },
    ]), { status: 200 }));

    await expect(getLatestApprovedAdmission(4)).resolves.toEqual({
      admission_id: 18,
      applicant_id: 4,
      campus_id: 2,
      program_id: 7,
      previous_school: "North High",
      status: "Approved",
    });
  });

  it("returns no enrollment gate when the latest admission is not approved", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { admission_id: 19, applicant_id: 4, campus_id: 2, program_id: 7, previous_school: "North High", status: "Pending" },
    ]), { status: 200 }));

    await expect(getLatestApprovedAdmission(4)).resolves.toBeNull();
  });

  it("loads course subjects for the approved program", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { subject_code: "GEN101", program_id: 7, title: "Understanding the Self", units: 3, days: "MWF", time_slot: "8:00 AM", room: "A101", instructor: "Faculty", subject_type: "General", is_required: true },
    ]), { status: 200 }));

    await expect(getCourseSubjectsForProgram(7)).resolves.toHaveLength(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("program_id=eq.7");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("COURSE_SUBJECT?");
  });
});
