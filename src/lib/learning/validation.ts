import { z } from "zod";
import { fromZagrebLocal } from "../academic/time";
import { serviceLoginUrl } from "../external-services";
const title = z.string().trim().min(2).max(200);
const body = z.string().trim().max(20000);
const link = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || (!!serviceLoginUrl(v) && !/[\s@]/.test(v)));
const revision = z.coerce.number().int().min(0).max(2147483646);
const item = z.union([z.uuid(), z.literal("")]).transform((v) => v || null);
const checked = z.enum(["on", ""]).transform((v) => v === "on");
const points = z
  .string()
  .trim()
  .regex(/^\d{1,5}(?:\.\d{1,2})?$/)
  .transform(Number);
const content = <T extends { body: string; resource_url: string }>(v: T) =>
  !!(v.body || v.resource_url);
export const learningSchemas = {
  material: z
    .object({
      course_id: z.uuid(),
      id: item,
      revision,
      title,
      body,
      resource_url: link,
      published: checked,
    })
    .refine(content),
  assignment: z.object({
    course_id: z.uuid(),
    id: item,
    revision,
    title,
    instructions: body.min(2),
    due_at: z.string().transform((v, ctx) => {
      if (!v) return null;
      try {
        return fromZagrebLocal(v);
      } catch {
        ctx.addIssue({ code: "custom", message: "Neispravan rok." });
        return z.NEVER;
      }
    }),
    max_points: points.pipe(z.number().positive().max(10000)),
    published: checked,
    allow_late: checked,
  }),
  submit: z
    .object({ assignment_id: z.uuid(), revision, body, resource_url: link })
    .refine(content),
  grade: z.object({
    submission_id: z.uuid(),
    revision,
    score: points.pipe(z.number().min(0).max(10000)),
    feedback: z.string().trim().max(5000),
  }),
};
export const learningErrors: Record<string, string> = {
  file_required:
    "Resurs Datoteka mora imati dovršen privitak prije objave. Odaberite datoteku ili najprije spremite nacrt.",
  section_not_empty:
    "Cjelina sadrži aktivnosti. Premjestite ih u drugu cjelinu prije brisanja.",
  quiz_locked:
    "Nakon prve predaje pitanja, odgovori i bodovi kviza više se ne mijenjaju. Za novu provjeru izradite novi kviz.",
  quiz_closed: "Kviz još nije otvoren ili je rok za predaju završio.",
  quiz_done: "Već ste predali ovaj kviz. Dostupan je jedan pokušaj.",
  invalid:
    "Promjena nije spremljena. Provjerite naslov, sadržaj, HTTPS poveznicu, rok i broj bodova.",
  forbidden:
    "Nemate pristup ovom kolegiju ili traženoj radnji. Osvježite stranicu i provjerite upis ili nastavničku dodjelu.",
  conflict:
    "Zapis je u međuvremenu promijenjen. Osvježite stranicu i pregledajte zadnju verziju prije ponovnog spremanja.",
  deadline:
    "Rok za predaju je istekao. Nastavnik može produljiti rok ili dopustiti zakašnjele predaje.",
  graded: "Predaja je već vrednovana i više je ne možete mijenjati.",
  points_locked:
    "Nakon prve predaje nije moguće promijeniti maksimalan broj bodova zadatka.",
  unavailable:
    "E-učenje nije dostupno. Administrator treba provjeriti migraciju 202611090002_native_learning.sql.",
};
export function learningError(message: string) {
  const code = message.match(/LEARNING_([A-Z_]+)/)?.[1]?.toLowerCase();
  return code && code in learningErrors ? code : "invalid";
}
