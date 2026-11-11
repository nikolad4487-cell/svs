import "server-only";
import { z } from "zod";
import { requireIdentity } from "../auth/access";
import {
  recordKindSchema,
  recordDefinitions,
  parseRecord,
  accountSchema,
  transactionSchema,
} from "./model";
export async function isspMutation(action: string, form: FormData) {
  const { db } = await requireIdentity("issp");
  const v = Object.fromEntries(form),
    inst = z.uuid().parse(v.institution_id);
  const revision = () =>
    z.coerce.number().int().min(0).max(2147483646).parse(v.revision);
  let r;
  if (action === "account") {
    const d = accountSchema.parse(v);
    r = await db.rpc("issp_save_account", {
      inst,
      student: z.uuid().parse(v.student_id),
      year_id: z.uuid().parse(v.academic_year_id),
      expected: revision(),
      data: { ...d, daily_support_cents: d.daily_support },
    });
  } else if (action === "record") {
    const kind = recordKindSchema.parse(v.kind);
    const payload = Object.fromEntries(
      recordDefinitions[kind].fields.map((f) => [
        f.name,
        String(v[`field_${f.name}`] || ""),
      ]),
    );
    r = await db.rpc("issp_save_record", {
      target_account: z.uuid().parse(v.account_id),
      record_kind: kind,
      data: parseRecord(kind, payload),
      evidence: z.string().trim().min(3).max(200).parse(v.reference),
      target: z.union([z.uuid(), z.literal("")]).parse(v.id) || null,
      expected: revision(),
      item_active: v.active === "on",
    });
  } else if (action === "transaction") {
    const d = transactionSchema.parse(v);
    r = await db.rpc("issp_post_transaction", {
      target_account: z.uuid().parse(v.account_id),
      transaction_kind: d.kind,
      amount_cents: d.amount,
      receipt_total: d.total,
      item_provider: d.provider,
      item_reference: d.reference,
      item_description: d.description,
      item_date: d.occurred_at,
    });
  } else if (action === "reverse") {
    r = await db.rpc("issp_post_transaction", {
      target_account: z.uuid().parse(v.account_id),
      transaction_kind: "reversal",
      amount_cents: 0,
      receipt_total: 0,
      item_provider: "Storno",
      item_reference: z.string().trim().min(3).max(200).parse(v.reference),
      item_description: z.string().trim().min(3).max(2000).parse(v.description),
      item_date: new Date().toISOString(),
      original: z.uuid().parse(v.transaction_id),
    });
  } else if (action === "preferences") {
    const d = z
      .object({
        contact_email: z.union([z.email().max(254), z.literal("")]),
        notifications: z.boolean(),
      })
      .refine((v) => !v.notifications || !!v.contact_email)
      .parse({
        contact_email: v.contact_email,
        notifications: v.notifications === "on",
      });
    r = await db.rpc("issp_save_preferences", {
      inst,
      email_address: d.contact_email,
      approved: d.notifications,
      expected: revision(),
    });
  } else if (action === "profile") {
    r = await db.rpc("issp_save_profile", {
      inst,
      student: z.uuid().parse(v.student_id),
      item_phone: z.string().trim().max(80).parse(v.phone),
      item_photo: z
        .string()
        .max(200)
        .parse(v.photo_path || ""),
      expected: revision(),
    });
  } else throw Error("ISSP_INVALID");
  if (r.error) {
    const code = r.error.message.match(/ISSP_([A-Z_]+)/)?.[1]?.toLowerCase();
    return ["PGRST202", "PGRST205", "42P01", "42883"].includes(r.error.code)
      ? "unavailable"
      : code || "invalid";
  }
  return "saved";
}
