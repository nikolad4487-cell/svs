import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fromZagrebLocal,
  zagrebInput,
  weekRange,
} from "../src/lib/academic/time";
import { earnedCredits } from "../src/lib/academic/summary";
import { schemas } from "../src/lib/academic/validation";
import type { Course, Exam, Grade } from "../src/lib/academic/model";
test("Croatian winter and summer inputs convert independently of server timezone", () => {
  assert.equal(fromZagrebLocal("2026-01-15T10:00"), "2026-01-15T09:00:00.000Z");
  assert.equal(fromZagrebLocal("2026-07-15T10:00"), "2026-07-15T08:00:00.000Z");
  assert.equal(zagrebInput("2026-07-15T08:00:00Z"), "2026-07-15T10:00");
});
test("invalid dates and DST gaps fail validation", () => {
  for (const value of ["invalid", "2026-02-30T12:00", "2026-03-29T02:30"])
    assert.throws(() => fromZagrebLocal(value));
});
test("week boundaries respect DST in Croatia", () => {
  const r = weekRange("2026-03-29");
  assert.equal(r.start, "2026-03-23");
  assert.equal(r.from, "2026-03-22T23:00:00.000Z");
  assert.equal(r.to, "2026-03-29T22:00:00.000Z");
});
test("ECTS never counts failed attempts, other students or duplicate passes", () => {
  const courses = [{ id: "c", code: "RAC101", ects: 6 }] as Course[];
  const exams = [
    { id: "e", course_id: "c" },
    { id: "e2", course_id: "c" },
  ] as Exam[];
  const grades = [
    { exam_id: "e", student_id: "u", grade: 1 },
    { exam_id: "e2", student_id: "u", grade: 4 },
    { exam_id: "e", student_id: "u", grade: 5 },
    { exam_id: "e2", student_id: "other", grade: 5 },
  ] as Grade[];
  assert.equal(earnedCredits(courses, exams, grades, "u"), 6);
  assert.equal(
    earnedCredits(
      courses,
      exams,
      [{ exam_id: "e", student_id: "u", grade: 1 }] as Grade[],
      "u",
    ),
    0,
  );
});
test("course ECTS and year/date constraints are validated on server", () => {
  assert.equal(
    schemas.course.safeParse({
      name: "Kolegij",
      code: "AB",
      program_id: "20000000-0000-4000-8000-000000000001",
      semester_id: "20000000-0000-4000-8000-000000000002",
      ects: 31,
    }).success,
    false,
  );
  assert.equal(
    schemas.year.safeParse({
      name: "2026./2027.",
      starts_on: "2027-10-01",
      ends_on: "2026-10-01",
    }).success,
    false,
  );
});
