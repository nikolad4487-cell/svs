import "server-only";
import { requireIdentity } from "../auth/access";
import { learningSchemas, learningError } from "./validation";
import { quizSchema, quizSubmissionSchema } from "./quizzes";

export async function learningMutation(action: string, form: FormData) {
  const { db } = await requireIdentity("merlin");
  const values = Object.fromEntries(form);
  for (const field of ["published", "allow_late"]) values[field] ||= "";
  let result;
  if (action === "material") {
    const d = learningSchemas.material.parse(values);
    result = await db.rpc("learning_save_material", {
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
    result = await db.rpc("learning_save_assignment", {
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
    result = await db.rpc("learning_save_quiz", {
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
