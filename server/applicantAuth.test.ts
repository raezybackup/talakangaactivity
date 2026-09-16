import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./applicantAuth";

describe("applicant password authentication", () => {
  it("hashes passwords without storing the raw password and verifies the original", async () => {
    const password = "correct horse battery staple";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^scrypt\$[^$]+\$[0-9a-f]+$/);
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", passwordHash)).resolves.toBe(false);
  });
});
