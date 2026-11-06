import "server-only";
import { z } from "zod";
import { requireIdentity } from "../auth/access";
import {
  enrollmentCaseSchema,
  studentRecordSchema,
  annualSchema,
} from "./registrar";
export async function registrarMutation(action: string, form: FormData) {
  const account = await requireIdentity("referada");
  const inst = z.uuid().parse(form.get("institution_id"));
  if (
    !account.superadmin &&
    !account.memberships.some(
      (m) =>
        m.institution_id === inst &&
        ["institution_admin", "registrar"].includes(m.role),
    )
  )
    throw new Error("forbidden");
  if (action === "invite") {
    const email = z
      .email()
      .max(254)
      .parse(
        String(form.get("email") || "")
          .trim()
          .toLowerCase(),
      );
    return (
      await account.db
        .from("registration_invites")
        .insert({
          institution_id: inst,
          email,
          role: "student",
          created_by: account.user.id,
        })
    ).error;
  }
  const revision = z.coerce
    .number()
    .int()
    .min(0)
    .parse(form.get("expected_revision"));
  const reason = z.string().trim().min(10).max(1000);
  if (action === "record") {
    const input = studentRecordSchema.parse(Object.fromEntries(form));
    return (
      await account.db.rpc("registrar_save_record", {
        inst,
        target: input.student_id,
        expected_revision: revision,
        data: input,
      })
    ).error;
  }
  if (action === "year") {
    const { student_id, academic_year_id, ...details } = annualSchema.parse(
      Object.fromEntries(form),
    );
    return (
      await account.db.rpc("registrar_save_year", {
        inst,
        target: student_id,
        year_id: academic_year_id,
        expected_revision: revision,
        data: details,
      })
    ).error;
  }
  if (action === "case") {
    const data = enrollmentCaseSchema.parse(Object.fromEntries(form));
    return (
      await account.db.rpc("registrar_save_case", {
        inst,
        target: form.get("id") ? z.uuid().parse(form.get("id")) : null,
        expected_revision: revision,
        data,
        reason: reason.parse(form.get("reason")),
      })
    ).error;
  }
  const target = z.uuid().parse(form.get("case_id"));
  const lookup = await account.db
    .from("registrar_enrollment_cases")
    .select("id")
    .eq("id", target)
    .eq("institution_id", inst)
    .single();
  if (!lookup.data) throw new Error("forbidden");
  if (action === "decision")
    return (
      await account.db.rpc("registrar_decide_case", {
        target,
        expected_revision: revision,
        next_state: z
          .enum(["draft", "approved", "cancelled"])
          .parse(form.get("next_state")),
        checks: {
          documents_verified: form.get("documents_verified") === "on",
          conditions_verified: form.get("conditions_verified") === "on",
          matura_verified: form.get("matura_verified") === "on",
          qualification_verified: form.get("qualification_verified") === "on",
        },
        reason: reason.parse(form.get("reason")),
      })
    ).error;
  if (action === "enroll")
    return (
      await account.db.rpc("registrar_enroll_case", {
        target,
        expected_revision: revision,
        selected_courses: z
          .array(z.uuid())
          .min(1)
          .max(100)
          .parse(form.getAll("course_id")),
        reason: reason.parse(form.get("reason")),
      })
    ).error;
  throw new Error("not-found");
}
