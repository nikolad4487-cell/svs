import type { Study } from "./model";
export const completionStates = [
  "legacy_unverified",
  "draft",
  "pending_verification",
  "completed",
  "cancelled",
] as const;
export type CompletionState = (typeof completionStates)[number];
export const completionNames: Record<CompletionState, string> = {
  legacy_unverified: "Povijesni upis — dovršenost nije provjerena",
  draft: "Nacrt upisnog lista",
  pending_verification: "Čeka provjeru referade",
  completed: "Upis dovršen u cijelosti",
  cancelled: "Upis otkazan",
};
export const completionChecks = [
  [
    "identity_verified",
    "identity_checked",
    "Identitet i pravo upisa provjereni",
  ],
  [
    "documents_verified",
    "documents_checked",
    "Obvezna dokumentacija provjerena",
  ],
  [
    "curriculum_verified",
    "curriculum_checked",
    "Obvezni i izborni kolegiji usklađeni s programom",
  ],
  [
    "financing_verified",
    "financing_checked",
    "Financiranje i obveze provjereni prema pravilima ustanove",
  ],
] as const;
export function enrollmentAllowsExams(study?: Study) {
  return (
    !!study &&
    study.status === "active" &&
    (!study.completion_status ||
      ["completed", "legacy_unverified"].includes(study.completion_status))
  );
}
