import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enrollmentCaseSchema,
  studentRecordSchema,
  annualSchema,
} from "../src/lib/academic/registrar";
import { canAccessModule } from "../src/lib/auth/policy";
const a = "10000000-0000-4000-8000-000000000001",
  b = "20000000-0000-4000-8000-000000000001";
const base = {
  student_id: a,
  program_id: a,
  academic_year_id: b,
  kind: "first_matura",
  study_year: "1",
  mode: "full_time",
  financing: "Prema odluci",
  admission_number: "K-123",
  decision_reference: "UP-123",
  source_institution: "",
  previous_study_id: "",
  winter_semester: "",
  summer_semester: "",
};
test("registrar workbench is limited to institution staff and never student or teacher roles", () => {
  for (const role of ["student", "teacher"] as const)
    assert.equal(
      canAccessModule("referada", false, [
        { institution_id: a, user_id: b, role },
      ]),
      false,
    );
  for (const role of ["registrar", "institution_admin"] as const)
    assert.equal(
      canAccessModule("referada", false, [
        { institution_id: a, user_id: b, role },
      ]),
      true,
    );
});
test("enrollment kinds validate previous year, source and postgraduate semesters without assuming admission proof", () => {
  assert.ok(enrollmentCaseSchema.safeParse(base).success);
  for (const kind of ["next_year", "repeat", "continuation"])
    assert.equal(
      enrollmentCaseSchema.safeParse({ ...base, kind }).success,
      false,
    );
  assert.equal(
    enrollmentCaseSchema.safeParse({ ...base, kind: "transfer" }).success,
    false,
  );
  assert.equal(
    enrollmentCaseSchema.safeParse({ ...base, kind: "postgraduate" }).success,
    false,
  );
  assert.ok(
    enrollmentCaseSchema.safeParse({
      ...base,
      kind: "postgraduate",
      winter_semester: "1",
    }).success,
  );
});
test("local dossier does not invent a JMBAG and official identifiers require an evidence reference", () => {
  const record = {
    student_id: a,
    legal_name: "Sintetski Student",
    birth_date: "",
    citizenship: "",
    jmbag: "",
    oib: "",
    identity_reference: "",
  };
  assert.ok(studentRecordSchema.safeParse(record).success);
  assert.equal(
    studentRecordSchema.safeParse({ ...record, jmbag: "123" }).success,
    false,
  );
  assert.equal(
    studentRecordSchema.safeParse({ ...record, jmbag: "0000000000" }).success,
    false,
  );
  assert.ok(
    studentRecordSchema.safeParse({
      ...record,
      jmbag: "0000000000",
      identity_reference: "DEMO-IZVOR",
    }).success,
  );
});
