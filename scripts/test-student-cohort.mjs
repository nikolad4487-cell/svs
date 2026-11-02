import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["127.0.0.1", "localhost"].includes(new URL(c.API_URL).hostname));
const admin = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const clients = [],
  cleanup = [];
let institution;
const insert = async (table, row) => {
  const r = await admin.from(table).insert(row).select("*").single();
  assert.ifError(r.error);
  return r.data;
};
try {
  const tag = randomUUID().slice(0, 8);
  institution = await insert("institutions", {
    name: `Cohort ${tag}`,
    code: `CH-${tag.toUpperCase()}`,
    email_domains: ["example.test"],
  });
  const program = await insert("study_programs", {
    institution_id: institution.id,
    name: "Testni program",
    code: "PR",
    degree: "Stručni",
    duration_years: 3,
  });
  const year = await insert("academic_years", {
    institution_id: institution.id,
    name: "2039/2040",
    starts_on: "2039-10-01",
    ends_on: "2040-09-30",
  });
  const semester = await insert("semesters", {
    institution_id: institution.id,
    academic_year_id: year.id,
    name: "Zimski",
    starts_on: "2039-10-01",
    ends_on: "2040-02-01",
  });
  const course = await insert("courses", {
    institution_id: institution.id,
    program_id: program.id,
    semester_id: semester.id,
    name: "Testni predmet",
    code: "CP",
    ects: 5,
  });
  for (let i = 0; i < 5; i++) {
    const email = `cohort-${tag}-${i}@example.test`,
      password = randomBytes(24).toString("base64url");
    const r = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(r.error);
    cleanup.push(r.data.user.id);
    await insert("memberships", {
      institution_id: institution.id,
      user_id: r.data.user.id,
      role: "student",
    });
    const study = await insert("student_studies", {
      institution_id: institution.id,
      student_id: r.data.user.id,
      program_id: program.id,
      academic_year_id: year.id,
      study_year: 1,
      student_number: `CH-${i}`,
      status: "active",
    });
    await insert("course_enrollments", {
      institution_id: institution.id,
      student_id: r.data.user.id,
      study_id: study.id,
      course_id: course.id,
    });
    const client = createClient(c.API_URL, c.ANON_KEY, {
      auth: { persistSession: false },
    });
    assert.ifError(
      (await client.auth.signInWithPassword({ email, password })).error,
    );
    clients.push(client);
    const summary = await clients[0].rpc("student_cohort_summary", {
      inst: institution.id,
      program: program.id,
      year_id: year.id,
    });
    assert.ifError(summary.error);
    if (i < 4) assert.equal(summary.data.available, false);
    else {
      assert.equal(summary.data.available, true);
      assert.equal(summary.data.average_enrolled_ects, 5);
      assert.equal(summary.data.average_enrolled_courses, 1);
      assert.equal(summary.data.average_earned_ects, 0);
      assert.equal(summary.data.average_passed_courses, 0);
      assert.equal(summary.data.average_grade, null);
    }
  }
  console.log(
    "Cohort aggregate passed: suppressed for 1–4 students; exact credits/course counts and no invented grades for 5 students.",
  );
} finally {
  if (institution) {
    await admin
      .from("course_enrollments")
      .delete()
      .eq("institution_id", institution.id);
    await admin
      .from("student_studies")
      .delete()
      .eq("institution_id", institution.id);
    await admin.from("courses").delete().eq("institution_id", institution.id);
    await admin.from("semesters").delete().eq("institution_id", institution.id);
    await admin
      .from("academic_years")
      .delete()
      .eq("institution_id", institution.id);
    for (const id of cleanup) await admin.auth.admin.deleteUser(id);
    await admin.from("study_programs").delete().eq("institution_id", institution.id);
    await admin
      .from("audit_logs")
      .delete()
      .eq("institution_id", institution.id);
    assert.ifError(
      (await admin.from("institutions").delete().eq("id", institution.id))
        .error,
    );
  }
}
