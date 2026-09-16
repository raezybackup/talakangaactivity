import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgramsForCampus } from "./supabase";

describe("campus program offerings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads only programs linked to the selected campus", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      {
        program_id: 12,
        program_name: "BS Information Systems",
        college: "College of Computer Studies",
        PROGRAM_CAMPUS: [{ campus_id: 2 }],
      },
    ]), { status: 200 }));

    await expect(getProgramsForCampus(2)).resolves.toEqual([{
      program_id: 12,
      program_name: "BS Information Systems",
      college: "College of Computer Studies",
    }]);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("PROGRAM_CAMPUS.campus_id=eq.2");
  });
});
