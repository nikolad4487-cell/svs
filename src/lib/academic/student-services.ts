import { z } from "zod";
export type ServiceField = {
  name: string;
  label: string;
  type?: "number" | "date" | "email" | "textarea";
  optional?: boolean;
};
export const serviceDefinitions = {
  dining: {
    title: "Razina prava na prehranu",
    fields: [
      { name: "level", label: "Razina prava" },
      { name: "valid_from", label: "Vrijedi od", type: "date" },
      { name: "valid_until", label: "Vrijedi do", type: "date" },
    ],
  },
  extra_ects: {
    title: "Dodatni ECTS bodovi",
    fields: [
      { name: "title", label: "Aktivnost / osnova priznavanja" },
      { name: "ects", label: "ECTS", type: "number" },
      { name: "date", label: "Datum priznavanja", type: "date" },
      { name: "reference", label: "Oznaka odluke" },
    ],
  },
  tuition: {
    title: "Pregled školarina",
    fields: [
      { name: "title", label: "Opis obveze" },
      { name: "amount", label: "Iznos EUR", type: "number" },
      { name: "paid", label: "Uplaćeno EUR", type: "number" },
      { name: "due_on", label: "Dospijeće", type: "date" },
      { name: "reference", label: "Poziv na broj", optional: true },
    ],
  },
  participation: {
    title: "Pregled izračunatih participacija",
    fields: [
      { name: "basis", label: "Temelj financiranja / pravilo ustanove" },
      { name: "full_amount", label: "Puni iznos EUR", type: "number" },
      { name: "ects_price", label: "Vrijednost ECTS boda EUR", type: "number" },
      { name: "unearned_ects", label: "ECTS za izračun", type: "number" },
      { name: "correction_percent", label: "Umanjenje (%)", type: "number" },
      { name: "maximum", label: "Maksimalni iznos EUR", type: "number" },
      { name: "note", label: "Obrazloženje / oslobođenje", type: "textarea" },
      { name: "date", label: "Datum izračuna", type: "date" },
    ],
  },
  mobility: {
    title: "Pregled boravaka",
    fields: [
      { name: "institution", label: "Ustanova boravka" },
      { name: "country", label: "Država" },
      { name: "purpose", label: "Svrha boravka" },
      { name: "starts_on", label: "Od", type: "date" },
      { name: "ends_on", label: "Do", type: "date" },
    ],
  },
  category: {
    title: "Kategorija studenta",
    fields: [
      { name: "category", label: "Kategorija" },
      { name: "reference", label: "Oznaka odluke" },
      { name: "valid_from", label: "Vrijedi od", type: "date" },
      { name: "valid_until", label: "Vrijedi do", type: "date" },
    ],
  },
  attendance: {
    title: "Prisustvo na nastavi",
    fields: [
      { name: "course_id", label: "ID kolegija" },
      { name: "date", label: "Datum", type: "date" },
      { name: "held_hours", label: "Održano sati", type: "number" },
      { name: "attended_hours", label: "Prisutno sati", type: "number" },
    ],
  },
  certificate: {
    title: "Potvrde",
    fields: [
      { name: "title", label: "Naziv potvrde" },
      { name: "reference", label: "Oznaka dokumenta" },
      { name: "date", label: "Datum izdavanja", type: "date" },
      { name: "body", label: "Sadržaj potvrde", type: "textarea" },
    ],
  },
} as const satisfies Record<
  string,
  { title: string; fields: readonly ServiceField[] }
>;
export type ServiceKind = keyof typeof serviceDefinitions;
const text = z.string().trim().min(1).max(200),
  date = z.iso.date(),
  money = z.coerce.number().min(0).max(1_000_000);
export const serviceSchemas = {
  dining: z
    .object({ level: text, valid_from: date, valid_until: date })
    .refine((v) => v.valid_from <= v.valid_until),
  extra_ects: z.object({
    title: text,
    ects: z.coerce.number().positive().max(120).multipleOf(0.5),
    date,
    reference: text,
  }),
  tuition: z
    .object({
      title: text,
      amount: money,
      paid: money,
      due_on: date,
      reference: z.string().max(200),
    })
    .refine((v) => v.paid <= v.amount),
  participation: z.object({
    basis: text,
    full_amount: money,
    ects_price: money,
    unearned_ects: z.coerce.number().min(0).max(480),
    correction_percent: z.coerce.number().min(0).max(100),
    maximum: money,
    note: z.string().min(1).max(5000),
    date,
  }),
  mobility: z
    .object({
      institution: text,
      country: text,
      purpose: text,
      starts_on: date,
      ends_on: date,
    })
    .refine((v) => v.starts_on <= v.ends_on),
  category: z
    .object({
      category: text,
      reference: text,
      valid_from: date,
      valid_until: date,
    })
    .refine((v) => v.valid_from <= v.valid_until),
  attendance: z
    .object({
      course_id: z.uuid(),
      date,
      held_hours: z.coerce.number().positive().max(24),
      attended_hours: z.coerce.number().min(0).max(24),
    })
    .refine((v) => v.attended_hours <= v.held_hours),
  certificate: z.object({
    title: text,
    reference: text,
    date,
    body: z.string().min(1).max(5000),
  }),
};
export function participationAmount(value: unknown) {
  const p = serviceSchemas.participation.parse(value);
  return (
    Math.round(
      Math.min(p.full_amount, p.maximum, p.ects_price * p.unearned_ects) *
        (1 - p.correction_percent / 100) *
        100,
    ) / 100
  );
}
export const personalFields = [
  { name: "residence_status", label: "Status stanovanja" },
  { name: "health_insurance", label: "Zdravstveno osiguranje" },
  { name: "first_enrollment_year", label: "Godina prvog upisa" },
  { name: "parallel_study", label: "Paralelni studij" },
  { name: "scholarship", label: "Stipendija" },
  { name: "permanent_address", label: "Adresa prebivališta" },
  { name: "temporary_address", label: "Adresa stanovanja" },
  { name: "supporter", label: "Uzdržavatelj" },
  { name: "supporter_occupation", label: "Zanimanje uzdržavatelja" },
  { name: "supporter_employment", label: "Položaj uzdržavatelja u zanimanju" },
  { name: "mother_education", label: "Obrazovanje majke" },
  { name: "mother_occupation", label: "Zanimanje majke" },
  { name: "mother_employment", label: "Položaj majke u zanimanju" },
  { name: "father_education", label: "Obrazovanje oca" },
  { name: "father_occupation", label: "Zanimanje oca" },
  { name: "father_employment", label: "Položaj oca u zanimanju" },
] as const;
export const personalSchema = z.object(
  Object.fromEntries(
    personalFields.map((f) => [f.name, z.string().trim().max(300)]),
  ),
);
export const preferencesSchema = z.object({
  contact_email: z.union([z.email().max(254), z.literal("")]),
  exam_registration: z.boolean(),
  exam_withdrawal: z.boolean(),
  announcements: z.boolean(),
});
export type StudentService = {
  id: string;
  institution_id: string;
  student_id: string;
  academic_year_id: string;
  kind: ServiceKind;
  payload: Record<string, string | number>;
};
export type StudentReport = {
  id: string;
  institution_id: string;
  student_id: string;
  academic_year_id: string;
  personal: Record<string, string>;
  preferences: {
    contact_email?: string;
    exam_registration?: boolean;
    exam_withdrawal?: boolean;
    announcements?: boolean;
  };
};
