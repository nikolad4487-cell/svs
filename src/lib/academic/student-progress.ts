import type { Course, Exam, Grade } from "./model";
export function studentProgress(
  courses: Course[],
  exams: Exam[],
  grades: Grade[],
  student: string,
) {
  const passed = new Map<string, { grade: number; ects: number }>();
  const own = grades
    .filter((g) => g.student_id === student && g.grade > 1)
    .sort((a, b) => b.graded_at.localeCompare(a.graded_at));
  for (const g of own) {
    const c = courses.find(
      (c) => c.id === exams.find((e) => e.id === g.exam_id)?.course_id,
    );
    if (c && !passed.has(c.code))
      passed.set(c.code, { grade: g.grade, ects: Number(c.ects) });
  }
  const values = [...passed.values()],
    earned = values.reduce((s, p) => s + p.ects, 0);
  return {
    passedCodes: [...passed.keys()],
    passedCourses: values.length,
    earned,
    average: values.length
      ? values.reduce((s, p) => s + p.grade, 0) / values.length
      : null,
    weighted: earned
      ? values.reduce((s, p) => s + p.grade * p.ects, 0) / earned
      : null,
  };
}
