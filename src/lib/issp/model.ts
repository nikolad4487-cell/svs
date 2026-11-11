import { z } from "zod";
import { fromZagrebLocal } from "../academic/time";
export const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,7}(?:[.,]\d{1,2})?$/)
  .transform((v) => {
    const [whole, decimal = ""] = v.replace(",", ".").split(".");
    return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  })
  .pipe(z.number().int().min(0).max(100000000));
export const euro = (cents: number | null | undefined) =>
  cents == null
    ? "Nije evidentirano"
    : new Intl.NumberFormat("hr-HR", {
        style: "currency",
        currency: "EUR",
      }).format(cents / 100);
export const moneyInput = (cents?: number | null) =>
  cents == null ? "" : (cents / 100).toFixed(2);
export function zagrebDay(value = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export type Field = {
  name: string;
  label: string;
  type?: "date" | "textarea";
  optional?: boolean;
  options?: readonly (readonly [string, string])[];
};
const status = [
  ["yes", "DA"],
  ["no", "NE"],
  ["unknown", "Nije provjereno"],
] as const;
export const workCriteria = [
  ["student", "Imate li status studenta?"],
  ["ects", "Ostvaren najmanje 1 ECTS u prethodnoj godini?"],
  ["first_year", "Prva godina nije upisana treći put?"],
  ["duration", "Studiranje nije dulje od dvostrukog trajanja studija?"],
  ["employment", "Student nije u radnom odnosu?"],
] as const;
export const diningCriteria = [
  ["regular", "Pravo temeljem redovitog upisa u tekuću akademsku godinu"],
  ["county", "Različita županija prebivališta i mjesta studiranja"],
  ["dorm", "Smještaj u domu koji ne pruža uslugu prehrane"],
] as const;
export const recordDefinitions = {
  work_criterion: {
    title: "Kriteriji dodjele prava na studentski rad",
    fields: [
      { name: "criterion", label: "Kriterij", options: workCriteria },
      { name: "status", label: "Uvjet zadovoljen", options: status },
    ],
  },
  dining_criterion: {
    title: "Kriteriji dodjele prava na prehranu",
    fields: [
      { name: "criterion", label: "Kriterij", options: diningCriteria },
      { name: "status", label: "Uvjet zadovoljen", options: status },
    ],
  },
  employment: {
    title: "Radno-pravni status",
    fields: [
      {
        name: "status",
        label: "Status zaposlenja",
        options: [
          ["not_employed", "Nije zaposlen"],
          ["employed", "Zaposlen"],
          ["unknown", "Nije provjereno"],
        ],
      },
      { name: "description", label: "Opis statusa" },
      { name: "checked_on", label: "Datum provjere", type: "date" },
    ],
  },
  termination: {
    title: "Evidentiran prestanak prava",
    fields: [
      { name: "date", label: "Datum prestanka", type: "date" },
      { name: "reason", label: "Razlog prestanka", type: "textarea" },
    ],
  },
  special_right: {
    title: "Posebno pravo",
    fields: [
      { name: "title", label: "Posebno pravo na prehranu" },
      { name: "starts_on", label: "Od", type: "date" },
      { name: "ends_on", label: "Do", type: "date" },
    ],
  },
  disability: {
    title: "Invaliditet",
    fields: [
      { name: "category", label: "Kategorija" },
      { name: "description", label: "Opis", type: "textarea" },
      {
        name: "consent",
        label: "Evidentirana suglasnost",
        options: [
          ["yes", "DA"],
          ["no", "NE"],
        ],
      },
    ],
  },
  dorm: {
    title: "Dom studenta",
    fields: [
      { name: "name", label: "Naziv doma" },
      {
        name: "type",
        label: "Vrsta",
        options: [
          ["student", "Studentski dom"],
          ["pupil", "Učenički dom"],
        ],
      },
    ],
  },
  pause: {
    title: "Mirovanja",
    fields: [
      { name: "program", label: "Studij" },
      { name: "starts_on", label: "Početak", type: "date" },
      { name: "ends_on", label: "Kraj", type: "date", optional: true },
      { name: "note", label: "Napomena", type: "textarea", optional: true },
    ],
  },
  card: {
    title: "Iskaznice",
    fields: [
      { name: "number", label: "Broj iskaznice" },
      {
        name: "status",
        label: "Status",
        options: [
          ["issued", "Izdana"],
          ["requested", "Zatražena"],
          ["lost", "Izgubljena"],
          ["revoked", "Poništena"],
        ],
      },
      { name: "print_status", label: "Status tiskanja" },
      { name: "model", label: "Naziv modela" },
      {
        name: "active",
        label: "Aktivna iskaznica",
        options: [
          ["yes", "DA"],
          ["no", "NE"],
        ],
      },
    ],
  },
  temporary_card: {
    title: "Privremene iskaznice",
    fields: [
      { name: "number", label: "Broj iskaznice" },
      { name: "status", label: "Status" },
      { name: "valid_until", label: "Vrijedi do", type: "date" },
      {
        name: "active",
        label: "Aktivna iskaznica",
        options: [
          ["yes", "DA"],
          ["no", "NE"],
        ],
      },
    ],
  },
  mobility: {
    title: "Mobilnost",
    fields: [
      { name: "host", label: "Ustanova INO" },
      { name: "country", label: "Država" },
      { name: "program", label: "Program razmjene" },
      {
        name: "direction",
        label: "Smjer",
        options: [
          ["out", "Odlazna"],
          ["in", "Dolazna"],
        ],
      },
      { name: "starts_on", label: "Početak", type: "date" },
      { name: "ends_on", label: "Kraj", type: "date" },
    ],
  },
  ownership: {
    title: "Vlasnik u visokom učilištu",
    fields: [
      { name: "name", label: "Visoko učilište" },
      { name: "date", label: "Datum ispisa", type: "date", optional: true },
      { name: "reason", label: "Opis razloga", optional: true },
    ],
  },
  esi: {
    title: "ESI oznaka studenta",
    fields: [
      { name: "value", label: "ESI" },
      { name: "created_on", label: "Datum stvaranja zapisa", type: "date" },
    ],
  },
} as const satisfies Record<
  string,
  { title: string; fields: readonly Field[] }
>;
export type RecordKind = keyof typeof recordDefinitions;
export const recordKindSchema = z.enum(
  Object.keys(recordDefinitions) as [RecordKind, ...RecordKind[]],
);
export function parseRecord(
  kind: RecordKind,
  value: unknown,
): Record<string, string> {
  const fields: readonly Field[] = recordDefinitions[kind].fields;
  const shape = Object.fromEntries(
    fields.map((f) => [
      f.name,
      f.options
        ? z.enum(f.options.map(([k]) => k) as [string, ...string[]])
        : f.type === "date"
          ? f.optional
            ? z.union([z.iso.date(), z.literal("")])
            : z.iso.date()
          : z
              .string()
              .trim()
              .min(f.optional ? 0 : 1)
              .max(f.type === "textarea" ? 2000 : 200),
    ]),
  );
  const data = z.object(shape).strict().parse(value);
  if (data.starts_on && data.ends_on && data.starts_on > data.ends_on)
    throw new Error("ISSP_INVALID");
  return data;
}
export const accountSchema = z
  .object({
    dining_enabled: z
      .enum(["on", ""])
      .default("")
      .transform((v) => v === "on"),
    rights_level: z.string().trim().max(50),
    valid_from: z.iso.date(),
    valid_until: z.iso.date(),
    daily_support: z.union([z.literal("").transform(() => null), moneySchema]),
    reference: z.string().trim().min(3).max(200),
    note: z.string().trim().max(2000),
  })
  .refine((v) => v.valid_from <= v.valid_until);
export const transactionSchema = z
  .object({
    kind: z.enum(["allocation", "purchase"]),
    amount: moneySchema,
    total: moneySchema,
    provider: z.string().trim().min(2).max(200),
    reference: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000),
    occurred_at: z.string().transform((v) => fromZagrebLocal(v)),
  })
  .refine((v) =>
    v.kind === "allocation" ? v.amount > 0 : v.total >= v.amount,
  );
export type Account = {
  id: string;
  institution_id: string;
  student_id: string;
  academic_year_id: string;
  dining_enabled: boolean;
  rights_level: string;
  valid_from: string;
  valid_until: string;
  daily_support_cents: number | null;
  reference: string;
  note: string;
  revision: number;
  updated_at: string;
};
export type IsspProfile = {
  id: string;
  phone: string;
  photo_path: string;
  revision: number;
};
export type IsspRecord = {
  id: string;
  account_id: string;
  kind: RecordKind;
  payload: Record<string, string>;
  reference: string;
  active: boolean;
  revision: number;
  updated_at: string;
};
export type Transaction = {
  id: string;
  account_id: string;
  kind: "allocation" | "purchase" | "reversal";
  delta_cents: number;
  total_cents: number;
  provider: string;
  reference: string;
  description: string;
  occurred_at: string;
  created_at: string;
  reverses_id: string | null;
};
export type Preferences = {
  contact_email: string;
  notifications: boolean;
  revision: number;
};
export function financialSummary(rows: Transaction[], today = zagrebDay()) {
  const reversed = new Set(
    rows.flatMap((r) => (r.reverses_id ? [r.reverses_id] : [])),
  );
  return {
    balance: rows.reduce((s, r) => s + r.delta_cents, 0),
    spentToday: rows
      .filter(
        (r) =>
          r.kind === "purchase" &&
          !reversed.has(r.id) &&
          zagrebDay(new Date(r.occurred_at)) === today,
      )
      .reduce((s, r) => s - r.delta_cents, 0),
    reversed,
  };
}
export const isspErrors: Record<string, string> = {
  rights:
    "Pravo na prehranu nije odobreno ili je evidentiran njegov prestanak.",
  invalid: "Provjerite unesene vrijednosti, datume i iznose.",
  forbidden: "Nemate ovlasti za odabranog studenta ili ustanovu.",
  conflict: "Zapis je promijenjen ili oznaka već postoji. Osvježite prikaz.",
  balance:
    "Nema dovoljno sredstava na lokalnom računu. Najprije evidentirajte dodjelu potpore.",
  dates: "Datum potrošnje mora biti unutar evidentiranog razdoblja prava.",
  reversed: "Ovaj je zapis već storniran.",
  unavailable:
    "ISSP evidencije još nisu uključene. Primijenite migraciju 202611110001_issp.sql.",
};

export function diningRightsActive(
  account: Account | undefined,
  records: IsspRecord[],
  today = zagrebDay(),
) {
  return (
    !!account &&
    account.dining_enabled &&
    account.valid_from <= today &&
    account.valid_until >= today &&
    !records.some(
      (r) =>
        r.account_id === account.id &&
        r.kind === "termination" &&
        r.active &&
        r.payload.date <= today,
    )
  );
}
