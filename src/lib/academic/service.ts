import "server-only";
import { z } from "zod";
import { requireIdentity } from "../auth/access";
import { schemas, tables, type AcademicAction } from "./validation";
import { examStates } from "./exam-workflow";
export async function academicMutation(action: string, form: FormData) {
  const account = await requireIdentity();
  const institution_id = z.uuid().parse(form.get("institution_id"));
  const manager =
    account.superadmin ||
    account.memberships.some(
      (m) =>
        m.institution_id === institution_id &&
        ["institution_admin", "registrar"].includes(m.role),
    );
  if (action === "exam-state") {
    const input = z
      .object({
        exam_id: z.uuid(),
        expected_status: z.enum(examStates),
        next_status: z.enum(examStates),
        reason: z.string().trim().min(10).max(1000),
      })
      .parse(Object.fromEntries(form));
    const exam = await account.db
      .from("exams")
      .select("id")
      .eq("institution_id", institution_id)
      .eq("id", input.exam_id)
      .single();
    if (!exam.data) throw new Error("forbidden");
    return (
      await account.db.rpc("transition_exam", {
        target: input.exam_id,
        expected_status: input.expected_status,
        next_status: input.next_status,
        reason: input.reason,
      })
    ).error;
  }
  if (action === "complete-enrollment") {
    if (!manager) throw new Error("forbidden");
    const input = z
      .object({
        study_id: z.uuid(),
        expected_revision: z.coerce.number().int().min(0),
        next_status: z.enum(["pending_verification", "completed", "cancelled"]),
        reason: z.string().trim().min(10).max(1000),
      })
      .parse(Object.fromEntries(form));
    const study = await account.db
      .from("student_studies")
      .select("id")
      .eq("id", input.study_id)
      .eq("institution_id", institution_id)
      .single();
    if (!study.data) throw new Error("forbidden");
    return (
      await account.db.rpc("complete_enrollment", {
        target: input.study_id,
        expected_revision: input.expected_revision,
        next_status: input.next_status,
        identity_checked: form.get("identity_checked") === "on",
        documents_checked: form.get("documents_checked") === "on",
        curriculum_checked: form.get("curriculum_checked") === "on",
        financing_checked: form.get("financing_checked") === "on",
        reason: input.reason,
      })
    ).error;
  }
  if (action === "register-exam") {
    const exam_id = z.uuid().parse(form.get("exam_id"));
    const { data: exam, error: lookup } = await account.db
      .from("exams")
      .select("id")
      .eq("institution_id", institution_id)
      .eq("id", exam_id)
      .single();
    if (lookup || !exam) throw new Error("forbidden");
    const result = await account.db.rpc("register_exam", {
      target: exam_id,
      cancel: form.get("cancel") === "true",
    });
    return result.error;
  }
  if (action === "grade") {
    const input = z
      .object({
        exam_id: z.uuid(),
        student_id: z.uuid(),
        grade: z.union([
          z.literal("absent"),
          z.coerce.number().int().min(1).max(5),
        ]),
        feedback: z.string().max(2000),
      })
      .parse(Object.fromEntries(form));
    const { data: exam } = await account.db
      .from("exams")
      .select("course_id")
      .eq("institution_id", institution_id)
      .eq("id", input.exam_id)
      .single();
    if (!exam) throw new Error("forbidden");
    if (!manager) {
      const teaching = await account.db
        .from("course_teachers")
        .select("id")
        .eq("institution_id", institution_id)
        .eq("course_id", exam.course_id)
        .eq("teacher_id", account.user.id)
        .maybeSingle();
      if (!teaching.data) throw new Error("forbidden");
    }
    return (
      await account.db.rpc(
        input.grade === "absent" ? "record_exam_absence" : "record_grade",
        {
          target: input.exam_id,
          student: input.student_id,
          ...(input.grade === "absent" ? {} : { result: input.grade }),
          note: input.feedback,
        },
      )
    ).error;
  }
  if (!Object.hasOwn(tables, action)) throw new Error("not-found");
  const kind = action as AcademicAction;
  const table = tables[kind];
  const input = schemas[kind].parse(Object.fromEntries(form));
  if (!manager) {
    if (!["exam", "schedule", "announcement"].includes(kind))
      throw new Error("forbidden");
    const course_id = "course_id" in input ? input.course_id : null;
    if (!course_id) throw new Error("forbidden");
    const own = await account.db
      .from("course_teachers")
      .select("id")
      .eq("course_id", course_id)
      .eq("institution_id", institution_id)
      .eq("teacher_id", account.user.id)
      .maybeSingle();
    if (!own.data) throw new Error("forbidden");
  }
  let payload: Record<string, unknown> = { ...input, institution_id };
  if (kind === "enrollment") {
    const study = await account.db
      .from("student_studies")
      .select("student_id")
      .eq("id", form.get("study_id"))
      .eq("institution_id", institution_id)
      .single();
    if (!study.data) throw new Error("forbidden");
    payload.student_id = study.data.student_id;
  }
  if (kind === "group-member") {
    const group = await account.db
      .from("teaching_groups")
      .select("course_id")
      .eq("id", form.get("group_id"))
      .eq("institution_id", institution_id)
      .single();
    if (!group.data) throw new Error("forbidden");
    payload.course_id = group.data.course_id;
  }
  if (kind === "announcement") payload.author_id = account.user.id;
  const id = form.get("id");
  if (id) {
    const identifier = z.uuid().parse(id);
    const result = await account.db
      .from(table)
      .update(payload)
      .eq("institution_id", institution_id)
      .eq("id", identifier)
      .select("id");
    if (!result.error && !result.data?.length) throw new Error("forbidden");
    return result.error;
  }
  return (await account.db.from(table).insert(payload)).error;
}
