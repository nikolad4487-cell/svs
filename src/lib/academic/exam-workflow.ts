export const examStates = [
  "draft",
  "open",
  "registration_closed",
  "in_progress",
  "grading",
  "locked",
] as const;
export type ExamState = (typeof examStates)[number];
export const examStateNames: Record<ExamState, string> = {
  draft: "Nacrt",
  open: "Otvorene prijave",
  registration_closed: "Prijave zatvorene",
  in_progress: "Ispit u tijeku",
  grading: "Obrada rezultata",
  locked: "Zaključan",
};
export function nextExamState(state: ExamState): ExamState {
  return state === "locked"
    ? "grading"
    : examStates[examStates.indexOf(state) + 1];
}
export const workflowErrors: Record<string, string> = {
  "enrollment-incomplete":
    "Upis nije administrativno dovršen. Obratite se referadi za provjeru dokumentacije i upisnog lista.",
  "enrollment-previous":
    "Prethodni upis nije administrativno dovršen. Referada ga treba provjeriti prije otvaranja iduće godine.",
  "enrollment-checks":
    "Provjerite sve četiri obvezne stavke i upišite najmanje jedan kolegij prije dovršenja upisa.",
  "enrollment-reopen":
    "Najprije ponovno otvorite provjeru dovršenog upisa, pa uredite upisni list.",
  "enrollment-stale":
    "Upis je u međuvremenu promijenjen. Osvježite prikaz prije ponovnog pokušaja.",
  "exam-incomplete":
    "Za sve važeće prijave evidentirajte ocjenu ili nedolazak prije zaključavanja.",
  "exam-stale":
    "Stanje roka je promijenjeno. Osvježite prikaz prije ponovnog pokušaja.",
  "exam-future":
    "Ispit još nije održan. Obradu i zaključavanje možete pokrenuti nakon početka ispita.",
  "exam-closed":
    "Stanje roka ne dopušta ovu radnju. Provjerite je li rok otvoren, u obradi ili zaključan.",
  "exam-expired":
    "Rok prijave je istekao. Uredite termin prije otvaranja nacrta.",
};
export function workflowErrorStatus(message: string) {
  if (message === "Upis nije administrativno dovršen. Obratite se referadi.")
    return "enrollment-incomplete";
  if (message === "Prethodni upis nije administrativno dovršen.")
    return "enrollment-previous";
  if (
    [
      "Provjerite identitet, dokumente, predmetnik i financiranje.",
      "Upis nema nijedan kolegij. Najprije sastavite upisni list.",
    ].includes(message)
  )
    return "enrollment-checks";
  if (message === "Najprije ponovno otvorite provjeru upisa.")
    return "enrollment-reopen";
  if (message === "Upis je promijenjen. Osvježite prikaz.")
    return "enrollment-stale";
  if (
    message === "Za sve važeće prijave treba evidentirati ocjenu ili nedolazak."
  )
    return "exam-incomplete";
  if (message === "Stanje roka je promijenjeno. Osvježite prikaz.")
    return "exam-stale";
  if (message === "Ispit još nije održan.") return "exam-future";
  if (message === "Rok prijave je istekao. Uredite termin prije otvaranja.")
    return "exam-expired";
  if (
    [
      "Ispitni rok je zaključan.",
      "Rok mora biti u obradi rezultata.",
      "Stanje roka ne dopušta prijavu ili odjavu.",
    ].includes(message)
  )
    return "exam-closed";
  return "academic-error";
}
