import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "../auth/access";
import type { LearningCourse, Material, Assignment, Submission } from "./model";
const missing = (code: string) =>
  ["PGRST202", "PGRST205", "42P01", "42883"].includes(code);
export async function learningData(courseId?: string) {
  const account = await requireIdentity("merlin");
  const { db } = account;
  const courses: LearningCourse[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.rpc("learning_courses").range(offset, offset + 499);
    if (result.error) {
      if (missing(result.error.code)) return null;
      throw new Error("Kolegiji e-učenja nisu dostupni.");
    }
    courses.push(...result.data);
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
  const ids = [...new Set(submissions.map((s) => s.student_id))];
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
  };
}
