import { describe, expect, it } from "vitest";
import { getDocumentRules } from "../client/src/config/application";

describe("admission application document rules", () => {
  it("requires the confirmed Freshmen documents and keeps SHS Diploma optional", () => {
    const rules = getDocumentRules("Freshmen");
    expect(rules.filter(rule => rule.required).map(rule => rule.type)).toEqual([
      "Form 138/Report Card",
      "PSA Birth Certificate",
      "Good Moral Certificate",
      "2x2 Photo",
    ]);
    expect(rules.find(rule => rule.type === "SHS Diploma")?.required).toBe(false);
  });

  it("uses the confirmed Transferee rules", () => {
    const rules = getDocumentRules("Transferee");
    expect(rules.filter(rule => rule.required).map(rule => rule.type)).toEqual([
      "Transcript of Records",
      "Honorable Dismissal/Transfer Credential",
      "Good Moral Certificate",
      "PSA Birth Certificate",
      "2x2 Photo",
    ]);
    expect(rules.some(rule => rule.type === "Form 138/Report Card")).toBe(false);
    expect(rules.find(rule => rule.type === "SHS Diploma")?.note).toContain("Transcript of Records");
  });

  it("uses the confirmed Ladderized rules", () => {
    const rules = getDocumentRules("Ladderized");
    expect(rules.filter(rule => rule.required).map(rule => rule.type)).toEqual([
      "Certificate/Diploma from previous ladder level",
      "Transcript of Records",
      "Good Moral Certificate",
      "PSA Birth Certificate",
      "2x2 Photo",
    ]);
    expect(rules.find(rule => rule.type === "Transfer Credentials")?.note).toContain("crediting units");
  });
});
