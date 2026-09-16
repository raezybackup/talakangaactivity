import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrpcResponse } from "../client/src/lib/trpcResponse";

describe("fetchTrpcResponse", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes a plain-text server failure into JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("A server error has occurred", { status: 500 }));

    const response = await fetchTrpcResponse("/api/trpc/applicantAuth.register");
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload[0].error.json.message).toContain("A server error has occurred");
    expect(payload[0].error.json.data.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("preserves valid JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ result: { data: { json: null } } }]), { status: 200 }));

    const response = await fetchTrpcResponse("/api/trpc/applicantAuth.me");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ result: { data: { json: null } } }]);
  });

  it("wraps a JSON object from a failed Function into a tRPC error batch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Supabase configuration is missing." }), { status: 500 }));

    const response = await fetchTrpcResponse("/api/trpc/applicantAuth.register");
    const payload = await response.json();

    expect(payload[0].error.json.message).toBe("Supabase configuration is missing.");
    expect(payload[0].error.json.data.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
