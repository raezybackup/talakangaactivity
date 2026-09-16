import { afterEach, describe, expect, it, vi } from "vitest";
import { getLatestAdmissionDetail, getLatestAdmissionStatus } from "./supabase";

describe("getLatestAdmissionStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the latest application status for the applicant", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ admission_id: 12, status: "Approved" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(getLatestAdmissionStatus(7)).resolves.toBe("Approved");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/rest/v1/ADMISSION_APPLICATION?"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer "),
          apikey: expect.any(String),
        }),
      }),
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("applicant_id=eq.7");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("order=admission_id.desc");
  });

  it("returns null when the applicant has no applications", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );

    await expect(getLatestAdmissionStatus(7)).resolves.toBeNull();
  });
});

describe("getLatestAdmissionDetail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the latest application followed by its document metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        admission_id: 12,
        status: "Pending",
        application_type: "Freshmen",
        prev_school: "CHMSU Senior High School",
        CAMPUS: { campus_name: "Talisay (Main)" },
        PROGRAM: { program_name: "BS Psychology", college: "College of Arts and Sciences" },
      }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ doc_type: "2x2 Photo", file_name: "photo.png", file_size_bytes: 100, file_path: "private/photo.png" }]), { status: 200 }));

    await expect(getLatestAdmissionDetail(7)).resolves.toMatchObject({
      admission_id: 12,
      status: "Pending",
      CAMPUS: { campus_name: "Talisay (Main)" },
      PROGRAM: { program_name: "BS Psychology" },
      documents: [{ doc_type: "2x2 Photo", file_name: "photo.png" }],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("admission_id=eq.12");
  });
});
