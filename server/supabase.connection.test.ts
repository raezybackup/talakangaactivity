import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServerKey = process.env.SUPABASE_SERVER_KEY;

describe("Supabase connection", () => {
  it("can read the APPLICANT table with the server credential", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\//);
    expect(supabaseServerKey).toBeTruthy();

    const response = await fetch(
      `${supabaseUrl}/rest/v1/APPLICANT?select=applicant_id&limit=1`,
      {
        headers: {
          apikey: supabaseServerKey!,
          Authorization: `Bearer ${supabaseServerKey}`,
        },
      },
    );

    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
