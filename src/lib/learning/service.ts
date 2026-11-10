import "server-only";
import { requireIdentity } from "../auth/access";
import { learningSchemas, learningError } from "./validation";
import { z } from "zod";
import { validRichDocument } from "./rich-text";
import { quizSchema, quizSubmissionSchema } from "./quizzes";

export async function learningMutation(action: string, form: FormData) {
  const { db } = await requireIdentity("merlin");
  const values = Object.fromEntries(form);
  for (const field of ["published", "allow_late"]) values[field] ||= "";
  let result;
  const saveContent = async (kind: string, args: Record<string, unknown>) => {
    if (
      !form.has("section_id") &&
      !form.has("rich_body") &&
      !form.has("resource_kind")
    )
      return db.rpc(`learning_save_${kind}`, args);
    const section = z
      .union([z.uuid(), z.literal("")])
      .parse(values.section_id || "");
    const resource = z
      .enum(["text", "page", "file", "folder", "url"])
      .parse(values.resource_kind || "text");
    let document: unknown = null;
    if (values.rich_body) {
      try {
        document = JSON.parse(String(values.rich_body));
      } catch {
        return { data: null, error: { code: "", message: "LEARNING_INVALID" } };
      }
      if (!validRichDocument(document))
        return { data: null, error: { code: "", message: "LEARNING_INVALID" } };
    }
    return db.rpc("learning_save_content", {
      target_course: args.target_course,
      kind,
      item: args,
      target_section: section || null,
      item_resource: resource,
      document,
    });
  };
  if (action === "material") {
    const d = learningSchemas.material.parse(values);
    result = await saveContent("material", {
      target_course: d.course_id,
      item_title: d.title,
      item_body: d.body,
      item_url: d.resource_url,
      item_published: d.published,
      target: d.id,
      expected: d.revision,
    });
  } else if (action === "assignment") {
    const d = learningSchemas.assignment.parse(values);
    result = await saveContent("assignment", {
      target_course: d.course_id,
      item_title: d.title,
      item_instructions: d.instructions,
      item_due: d.due_at,
      item_max: d.max_points,
      item_published: d.published,
      item_late: d.allow_late,
      target: d.id,
      expected: d.revision,
    });
  } else if (action === "submit") {
    const d = learningSchemas.submit.parse(values);
    result = await db.rpc("learning_submit", {
      target: d.assignment_id,
      answer: d.body,
      answer_url: d.resource_url,
      expected: d.revision,
    });
  } else if (action === "grade") {
    const d = learningSchemas.grade.parse(values);
    result = await db.rpc("learning_grade", {
      target: d.submission_id,
      points: d.score,
      note: d.feedback,
      expected: d.revision,
    });
  } else if (action === "quiz") {
    const d = quizSchema.parse(values);
    result = await saveContent("quiz", {
      target_course: d.course_id,
      item_title: d.title,
      item_description: d.description,
      item_opens: d.opens_at,
      item_closes: d.closes_at,
      item_published: d.published,
      questions: d.questions,
      target: d.id,
      expected: d.revision,
    });
  } else if (action === "section") {
    const d = z
      .object({
        course_id: z.uuid(),
        id: z.union([z.uuid(), z.literal("")]),
        revision: z.coerce.number().int().min(0),
        title: z.string().trim().min(2).max(200),
        summary: z.string().trim().max(5000),
        published: z.enum(["", "on"]),
      })
      .parse(values);
    result = await db.rpc("learning_save_section", {
      target_course: d.course_id,
      target: d.id || null,
      expected: d.revision,
      item_title: d.title,
      item_summary: d.summary,
      item_published: d.published === "on",
    });
  } else if (action === "section-order" || action === "activity-order") {
    const d = z
      .object({
        course_id: z.uuid(),
        id: z.uuid(),
        revision: z.coerce.number().int().min(1),
        direction: z.enum(
          action === "section-order"
            ? ["up", "down", "delete"]
            : ["up", "down"],
        ),
        kind: z.enum(["material", "assignment", "quiz"]).optional(),
      })
      .parse(values);
    result = await db.rpc(
      action === "section-order"
        ? "learning_order_section"
        : "learning_order_activity",
      {
        target_course: d.course_id,
        target: d.id,
        expected: d.revision,
        direction: d.direction,
        ...(action === "activity-order"
          ? { kind: z.enum(["material", "assignment", "quiz"]).parse(d.kind) }
          : {}),
      },
    );
  } else if (action === "quiz-submit") {
    const d = quizSubmissionSchema.parse(values);
    result = await db.rpc("learning_submit_quiz", {
      target: d.quiz_id,
      expected: d.revision,
      responses: d.answers,
    });
  } else throw new Error("Nepoznata radnja.");
  if (!result.error)
    return {
      status: "saved",
      id: typeof result.data === "string" ? result.data : undefined,
      revision: Number(values.revision) + 1,
    };
  const status = ["PGRST202", "PGRST205", "42P01", "42883"].includes(
    result.error.code,
  )
    ? "unavailable"
    : learningError(result.error.message);
  return { status };
}
