import { z } from "zod";
export const enrollmentKinds = {
  first_matura: "Prvi upis s državne mature",
  first_selection: "Prvi upis s razredbenog postupka",
  next_year: "Upis više godine",
  repeat: "Ponavljanje godine",
  transfer: "Prijelaz s drugog učilišta ili studija",
  parallel: "Paralelni studij",
  postgraduate: "Upis poslijediplomskog studija",
  continuation: "Nastavak nakon mirovanja ili prekida",
} as const;
export const caseStates = {
  draft: "U pripremi",
  approved: "Provjeren — spreman za upis",
  enrolled: "Upisni list izrađen",
  cancelled: "Poništen postupak",
} as const;
export type EnrollmentKind = keyof typeof enrollmentKinds;
export type EnrollmentCase = {
  id: string;
  institution_id: string;
  student_id: string;
  program_id: string;
  academic_year_id: string;
  kind: EnrollmentKind;
  study_year: number;
  mode: "full_time" | "part_time";
  financing: string;
  admission_number: string;
  decision_reference: string;
  source_institution: string;
  previous_study_id: string | null;
  winter_semester: number | null;
  summer_semester: number | null;
  state: keyof typeof caseStates;
  revision: number;
  study_id: string | null;
  documents_verified: boolean;
  conditions_verified: boolean;
  matura_verified: boolean;
  qualification_verified: boolean;
};
const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => v || null);
const semester = z
  .union([z.literal(""), z.coerce.number().int().min(1).max(16)])
  .transform((v) => (v === "" ? null : v));
export const enrollmentCaseSchema = z
  .object({
    student_id: z.uuid(),
    program_id: z.uuid(),
    academic_year_id: z.uuid(),
    kind: z.enum(
      Object.keys(enrollmentKinds) as [EnrollmentKind, ...EnrollmentKind[]],
    ),
    study_year: z.coerce.number().int().min(1).max(8),
    mode: z.enum(["full_time", "part_time"]),
    financing: z.string().trim().min(2).max(300),
    admission_number: z.string().trim().max(100),
    decision_reference: z.string().trim().min(3).max(300),
    source_institution: z.string().trim().max(300),
    previous_study_id: optionalUuid,
    winter_semester: semester,
    summer_semester: semester,
  })
  .superRefine((v, ctx) => {
    if (
      ["next_year", "repeat", "continuation"].includes(v.kind) &&
      !v.previous_study_id
    )
      ctx.addIssue({
        code: "custom",
        path: ["previous_study_id"],
        message: "Odaberite prethodni godišnji upis.",
      });
    if (v.kind === "transfer" && v.source_institution.length < 2)
      ctx.addIssue({
        code: "custom",
        path: ["source_institution"],
        message: "Navedite izvornu ustanovu ili studij.",
      });
    if (v.kind === "postgraduate" && !v.winter_semester && !v.summer_semester)
      ctx.addIssue({
        code: "custom",
        path: ["winter_semester"],
        message: "Odaberite najmanje jedan semestar.",
      });
  });
export type StudentRecord = {
  id: string;
  institution_id: string;
  student_id: string;
  local_number: string;
  legal_name: string;
  birth_date: string | null;
  citizenship: string;
  jmbag: string;
  oib: string;
  identity_reference: string;
  revision: number;
};
export const studentRecordSchema = z
  .object({
    student_id: z.uuid(),
    legal_name: z.string().trim().min(2).max(200),
    birth_date: z
      .union([z.iso.date(), z.literal("")])
      .transform((v) => v || null),
    citizenship: z.string().trim().max(100),
    jmbag: z.union([z.literal(""), z.string().regex(/^\d{10}$/)]),
    oib: z.union([z.literal(""), z.string().regex(/^\d{11}$/)]),
    identity_reference: z.string().trim().max(300),
  })
  .refine((v) => (!v.jmbag && !v.oib) || v.identity_reference.length >= 3, {
    message: "Za službene identifikatore navedite izvor provjere.",
  });
export const annualFields = [
  ["residence_country", "Država prebivališta"],
  ["residence_city", "Mjesto prebivališta"],
  ["residence_postcode", "Poštanski broj prebivališta"],
  ["residence_address", "Adresa prebivališta"],
  ["residence_confirmation_date", "Datum potvrde o prebivalištu"],
  ["housing_city", "Mjesto stanovanja"],
  ["housing_address", "Adresa stanovanja"],
  ["housing_status", "Status stanovanja"],
  ["health_insurance", "Zdravstveno osiguranje"],
  ["marital_status", "Bračno stanje"],
  ["scholarship", "Stipendija"],
  ["mother_education", "Obrazovanje majke"],
  ["mother_occupation", "Zanimanje majke"],
  ["mother_employment", "Položaj majke u zanimanju"],
  ["father_education", "Obrazovanje oca"],
  ["father_occupation", "Zanimanje oca"],
  ["father_employment", "Položaj oca u zanimanju"],
  ["supporter", "Način uzdržavanja"],
  ["supporter_occupation", "Zanimanje uzdržavatelja"],
  ["supporter_employment", "Položaj uzdržavatelja u zanimanju"],
] as const;
export const annualSchema = z.object({
  student_id: z.uuid(),
  academic_year_id: z.uuid(),
  ...Object.fromEntries(
    annualFields.map(([k]) => [
      k,
      k === "residence_confirmation_date"
        ? z.union([z.iso.date(), z.literal("")])
        : z.string().trim().max(300),
    ]),
  ),
});
export type StudentYearRecord = {
  id: string;
  institution_id: string;
  student_id: string;
  academic_year_id: string;
  revision: number;
  details: Record<string, string>;
};
export const registrarErrors: Record<string, string> = {
  "registrar-program": "Prije upisa dopunite trajanje i razinu studijskog programa u administraciji studija.",
  "registrar-identity":
    "Najprije u studentskom dosjeu evidentirajte službeno ime i prezime studenta.",
  "registrar-stale": "Postupak je u međuvremenu promijenjen. Osvježite prikaz.",
  "registrar-checks":
    "Provjerite dokumente, uvjete i dokaz mature ili prethodne kvalifikacije za odabranu vrstu upisa.",
  "registrar-courses":
    "Odaberite kolegije koji pripadaju odabranom studiju i akademskoj godini.",
  "registrar-previous":
    "Prethodni upis mora pripadati istom studentu i studiju, biti administrativno dovršen te odgovarati vrsti novog upisa.",
  "registrar-existing":
    "Za tog studenta, studij i godinu već postoji postupak ili dovršen upis. Otvorite postojeći zapis.",
  "registrar-postgraduate":
    "Za poslijediplomski upis odaberite poslijediplomski program i najmanje jedan valjan semestar.",
};
export function registrarError(code: string, message: string) {
  if (code === "23505") return "registrar-existing";
  if (message.startsWith("REGISTRAR_")) {
    const key = message.slice(10).toLowerCase();
    if (Object.hasOwn(registrarErrors, `registrar-${key}`))
      return `registrar-${key}`;
  }
  return "academic-error";
}
