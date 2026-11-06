import { test } from "node:test";
import assert from "node:assert/strict";
import { earnedCredits } from "../src/lib/academic/summary";
import { studentProgress } from "../src/lib/academic/student-progress";
import type { Course, Exam, Grade } from "../src/lib/academic/model";
test("absence and corrected failures never create ECTS or distort grade averages", () => {
  const courses = [
    { id: "c1", code: "C1", ects: 6 },
    { id: "c2", code: "C2", ects: 4 },
  ] as Course[];
  const exams = [
    { id: "e1", course_id: "c1" },
    { id: "e2", course_id: "c2" },
  ] as Exam[];
  const grades = [
    {
      student_id: "s",
      exam_id: "e1",
      grade: null,
      outcome: "absent",
      graded_at: "2026-11-01",
    },
    {
      student_id: "s",
      exam_id: "e2",
      grade: 4,
      outcome: "graded",
      graded_at: "2026-11-01",
    },
  ] as Grade[];
  assert.equal(earnedCredits(courses, exams, grades, "s"), 4);
  assert.deepEqual(studentProgress(courses, exams, grades, "s"), {
    passedCodes: ["C2"],
    passedCourses: 1,
    earned: 4,
    average: 4,
    weighted: 4,
  });
  grades[1].grade = 1;
  assert.equal(earnedCredits(courses, exams, grades, "s"), 0);
  assert.equal(studentProgress(courses, exams, grades, "s").average, null);
});
