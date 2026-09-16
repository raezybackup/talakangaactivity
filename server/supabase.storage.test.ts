import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDocumentBucket } from "./supabase";

describe("ensureDocumentBucket", () => {
  afterEach(() => vi.restoreAllMocks());

  it("treats an existing bucket response as success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      statusCode: "409",
      error: "Duplicate",
      code: "BucketAlreadyExists",
    }), { status: 400 }));

    await expect(ensureDocumentBucket()).resolves.toBeUndefined();
  });

  it("still rejects unrelated storage errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("storage unavailable", { status: 503 }));

    await expect(ensureDocumentBucket()).rejects.toThrow("Supabase storage bucket failed (503)");
  });
});
