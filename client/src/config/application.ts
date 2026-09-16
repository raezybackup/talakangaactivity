export type ApplicationType = "Freshmen" | "Transferee" | "Ladderized";
export type DocumentRule = { type: string; required: boolean; note?: string };

const rules: Record<ApplicationType, DocumentRule[]> = {
  Freshmen: [
    { type: "Form 138/Report Card", required: true },
    { type: "PSA Birth Certificate", required: true },
    { type: "Good Moral Certificate", required: true },
    { type: "2x2 Photo", required: true },
    { type: "SHS Diploma", required: false, note: "Optional when the Form 138/Report Card is available." },
  ],
  Transferee: [
    { type: "Transcript of Records", required: true },
    { type: "Honorable Dismissal/Transfer Credential", required: true },
    { type: "Good Moral Certificate", required: true },
    { type: "PSA Birth Certificate", required: true },
    { type: "2x2 Photo", required: true },
    { type: "SHS Diploma", required: false, note: "Optional; the Transcript of Records is the primary academic record." },
  ],
  Ladderized: [
    { type: "Certificate/Diploma from previous ladder level", required: true },
    { type: "Transcript of Records", required: true },
    { type: "Good Moral Certificate", required: true },
    { type: "PSA Birth Certificate", required: true },
    { type: "2x2 Photo", required: true },
    { type: "Transfer Credentials", required: false, note: "Optional; submit for crediting units when applicable." },
  ],
};

export function getDocumentRules(applicationType: ApplicationType): DocumentRule[] {
  return rules[applicationType].map(rule => ({ ...rule }));
}
