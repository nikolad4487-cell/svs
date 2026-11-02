import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serviceSchemas,
  personalSchema,
  preferencesSchema,
  participationAmount,
  personalFields,
} from "../src/lib/academic/student-services";
import { schemas } from "../src/lib/academic/validation";
import { studentProgress } from "../src/lib/academic/student-progress";
test("participation uses bounded institutional parameters and exact cents", () => {
  const p = {
    basis: "Odluka ustanove",
    full_amount: 1000,
    ects_price: 20,
    unearned_ects: 30,
    correction_percent: 10,
    maximum: 500,
    note: "Odluka",
    date: "2026-11-02",
  };
  assert.equal(participationAmount(p), 450);
  assert.equal(participationAmount({ ...p, correction_percent: 100 }), 0);
  assert.throws(() => participationAmount({ ...p, correction_percent: 101 }));
  assert.throws(() => participationAmount({ ...p, ects_price: -1 }));
});
test("student entitlements reject impossible dates, credits, payments and attendance", () => {
  assert.equal(
    serviceSchemas.extra_ects.parse({
      title: "Praksa",
      ects: "2.5",
      date: "2026-11-02",
      reference: "OD-1",
    }).ects,
    2.5,
  );
  assert.throws(() =>
    serviceSchemas.extra_ects.parse({
      title: "Praksa",
      ects: 2.3,
      date: "2026-11-02",
      reference: "OD-1",
    }),
  );
  assert.throws(() =>
    serviceSchemas.dining.parse({
      level: "2.5",
      valid_from: "2026-12-01",
      valid_until: "2026-01-01",
    }),
  );
  assert.throws(() =>
    serviceSchemas.tuition.parse({
      title: "Rata",
      amount: 100,
      paid: 101,
      due_on: "2026-11-02",
      reference: "",
    }),
  );
  assert.throws(() =>
    serviceSchemas.attendance.parse({
      course_id: "10000000-0000-4000-8000-000000000001",
      date: "2026-11-02",
      held_hours: 2,
      attended_hours: 3,
    }),
  );
  const personal = Object.fromEntries(personalFields.map((f) => [f.name, ""]));
  assert.ok(personalSchema.safeParse(personal).success);
  assert.ok(
    !preferencesSchema.safeParse({
      contact_email: "not email",
      exam_registration: true,
      exam_withdrawal: false,
      announcements: true,
    }).success,
  );
});
test("progress counts passed courses once and computes weighted averages from own grades", () => {
  const courses: any[] = [
    { id: "a", code: "A", ects: 5 },
    { id: "b", code: "B", ects: 10 },
    { id: "c", code: "C", ects: 3 },
  ];
  const exams: any[] = [
    { id: "ea", course_id: "a" },
    { id: "eb", course_id: "b" },
    { id: "ec", course_id: "c" },
  ];
  const grades: any[] = [
    { student_id: "s", exam_id: "ea", grade: 2, graded_at: "2026-01-01" },
    { student_id: "s", exam_id: "ea", grade: 4, graded_at: "2026-02-01" },
    { student_id: "s", exam_id: "eb", grade: 5, graded_at: "2026-02-01" },
    { student_id: "s", exam_id: "ec", grade: 1, graded_at: "2026-02-01" },
    { student_id: "other", exam_id: "ec", grade: 5, graded_at: "2026-02-01" },
  ];
  const p = studentProgress(courses, exams, grades, "s");
  assert.equal(p.earned, 15);
  assert.equal(p.passedCourses, 2);
  assert.equal(p.average, 4.5);
  assert.equal(p.weighted, 70 / 15);
  assert.equal(studentProgress([], [], [], "s").average, null);
});

test("non-credit courses are valid and fractional invalid credits are rejected", () => {
 const course={program_id:"10000000-0000-4000-8000-000000000001",semester_id:"10000000-0000-4000-8000-000000000002",name:"Tjelesna kultura",code:"TZK",ects:"0"};
 assert.equal(schemas.course.parse(course).ects,0);
 assert.throws(()=>schemas.course.parse({...course,ects:"-0.5"}));
 assert.throws(()=>schemas.course.parse({...course,ects:"0.3"}));
});
