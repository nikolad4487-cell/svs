import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "../auth/access";
import type {
  LearningCourse,
  Material,
  Assignment,
  Submission,
  Section,
} from "./model";
import type { LearningFile } from "./files";
import type { Quiz, QuizQuestion, QuizKey, QuizAttempt } from "./quizzes";
const missing = (code: string) =>
  ["PGRST202", "PGRST205", "42P01", "42883"].includes(code);
export async function learningData(courseId?: string, institutionId?: string) {
  const account = await requireIdentity("merlin");
  const { db } = account;
  const courses: LearningCourse[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.rpc("learning_courses").range(offset, offset + 499);
    if (result.error) {
      if (missing(result.error.code)) return null;
      throw new Error("Kolegiji e-učenja nisu dostupni.");
    }
    courses.push(
      ...result.data.filter(
        (c: LearningCourse) =>
          !institutionId || c.institution_id === institutionId,
      ),
    );
    if (result.data.length < 500) break;
  }
  const course = courses.find((c) => c.id === courseId);
  if (courseId && !course) notFound();
  const rows = async <T>(table: string) => {
    const values: T[] = [];
    if (!course) return values;
    for (let offset = 0; ; offset += 500) {
      const result = await db
        .from(table)
        .select("*")
        .eq("course_id", course.id)
        .order("id")
        .range(offset, offset + 499);
      if (result.error)
        throw new Error(
          "Sadržaj e-učenja nije dostupan. Provjerite migracije.",
        );
      values.push(...result.data);
      if (result.data.length < 500) return values;
    }
  };
  const [materials, assignments, submissions] = await Promise.all([
    rows<Material>("learning_materials"),
    rows<Assignment>("learning_assignments"),
    rows<Submission>("learning_submissions"),
  ]);
  const profiles: { id: string; full_name: string }[] = [];
  const files: LearningFile[] = [];
  let filesReady = true;
  if (course) {
    for (let offset = 0; ; offset += 500) {
      const result = await db
        .from("learning_files")
        .select("*")
        .eq("course_id", course.id)
        .order("id")
        .range(offset, offset + 499);
      if (result.error) {
        if (missing(result.error.code)) {
          filesReady = false;
          break;
        }
        throw new Error("Privitci nisu dostupni.");
      }
      files.push(...result.data);
      if (result.data.length < 500) break;
    }
  }
  const optionalRows = async <T>(table: string) => {
    const data: T[] = [];
    if (!course) return { ready: true, data };
    for (let offset = 0; ; offset += 500) {
      const result = await db
        .from(table)
        .select("*")
        .eq("course_id", course.id)
        .order("id")
        .range(offset, offset + 499);
      if (result.error) {
        if (missing(result.error.code))
          return { ready: false, data: [] as T[] };
        throw new Error("Kvizovi nisu dostupni.");
      }
      data.push(...result.data);
      if (result.data.length < 500) return { ready: true, data };
    }
  };
  const [quizRows, questionRows, attemptRows, sectionRows] = await Promise.all([
    optionalRows<Quiz>("learning_quizzes"),
    optionalRows<QuizQuestion>("learning_quiz_questions"),
    optionalRows<QuizAttempt>("learning_quiz_attempts"),
    optionalRows<Section>("learning_sections"),
  ]);
  const dashboardEvents: {
    id: string;
    title: string;
    courseId: string;
    courseName: string;
    date: string;
    kind: string;
    view: string;
    published: boolean;
  }[] = [];
  if (!course) {
    for (let start = 0; start < courses.length; start += 100) {
      const ids = courses.slice(start, start + 100).map((c) => c.id);
      for (const [table, columns] of [
        ["learning_assignments", "id,course_id,title,due_at,published"],
        ["learning_quizzes", "id,course_id,title,opens_at,closes_at,published"],
      ] as const) {
        for (let offset = 0; ; offset += 500) {
          const r = await db
            .from(table)
            .select(columns)
            .in("course_id", ids)
            .order("id")
            .range(offset, offset + 499);
          if (r.error) {
            if (missing(r.error.code)) break;
            throw new Error("Rokovi e-učenja nisu dostupni.");
          }
          for (const row of r.data as unknown as {
            id: string;
            course_id: string;
            title: string;
            due_at?: string;
            closes_at?: string;
            opens_at?: string;
            published: boolean;
          }[]) {
            const date = row.due_at || row.closes_at || row.opens_at;
            if (date)
              dashboardEvents.push({
                id: row.id,
                title: row.title,
                courseId: row.course_id,
                courseName: courses.find((c) => c.id === row.course_id)!.name,
                date,
                kind:
                  table === "learning_assignments"
                    ? "Zadaća"
                    : row.closes_at
                      ? "Rok kviza"
                      : "Otvaranje kviza",
                view: table === "learning_assignments" ? "Zadaci" : "Kvizovi",
                published: row.published,
              });
          }
          if (r.data.length < 500) break;
        }
      }
    }
  }
  const quizKeys: QuizKey[] = [];
  if (course?.can_manage && questionRows.data.length) {
    for (let offset = 0; offset < questionRows.data.length; offset += 200) {
      const result = await db
        .from("learning_quiz_keys")
        .select("question_id,correct_index")
        .in(
          "question_id",
          questionRows.data.slice(offset, offset + 200).map((q) => q.id),
        );
      if (result.error)
        throw new Error("Nastavnički podaci kviza nisu dostupni.");
      quizKeys.push(...result.data);
    }
  }
  const ids = [
    ...new Set([
      ...submissions.map((s) => s.student_id),
      ...attemptRows.data.map((a) => a.student_id),
    ]),
  ];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const result = await db
      .from("profiles")
      .select("id,full_name")
      .in("id", ids.slice(offset, offset + 200));
    if (result.error) throw new Error("Imena predavatelja rada nisu dostupna.");
    profiles.push(...result.data);
  }
  return {
    account,
    courses,
    course,
    materials,
    assignments,
    submissions,
    profiles,
    files,
    filesReady,
    quizzesReady: quizRows.ready && questionRows.ready && attemptRows.ready,
    quizzes: quizRows.data,
    quizQuestions: questionRows.data,
    quizAttempts: attemptRows.data,
    quizKeys,
    dashboardEvents,
    sections: sectionRows.data.sort(
      (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
    ),
    sectionsReady: sectionRows.ready,
  };
}
