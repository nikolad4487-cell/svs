import type { Course, Exam, Grade } from "./model";
export function earnedCredits(
  courses: Course[],
  exams: Exam[],
  grades: Grade[],
  studentId: string,
) {
  const credits = new Map<string, number>();
  for (const grade of grades.filter(
    (g) => g.student_id === studentId && g.grade > 1,
  )) {
    const exam = exams.find((e) => e.id === grade.exam_id);
    const course = courses.find((c) => c.id === exam?.course_id);
    if (course && !credits.has(course.code))
      credits.set(course.code, Number(course.ects));
  }
  return [...credits.values()].reduce((sum, value) => sum + value, 0);
}
