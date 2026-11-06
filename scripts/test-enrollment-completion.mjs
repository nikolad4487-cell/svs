import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["127.0.0.1", "localhost"].includes(new URL(c.API_URL).hostname));
const users = JSON.parse(readFileSync(".local-test-users.json")),
  f = JSON.parse(readFileSync(".local-academic.json"));
const service = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }),
  db = {};
for (const role of ["student", "student2", "admin", "referada", "nastavnik"]) {
  const client = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert.ifError((await client.auth.signInWithPassword(users[role])).error);
  db[role] = client;
}
const ok = async (q) => {
  const r = await q;
  assert.ifError(r.error);
  return r.data;
};
const no = async (q) => {
  const r = await q;
  assert.ok(r.error, "Expected rejection");
  return r.error;
};
let program,
  course,
  study,
  enrollment,
  exam,
  laterYear,
  laterStudy,
  server,
  count = 0;
const check = async (label, run) => {
  await run();
  console.log(`PASS ${label}`);
  count++;
};
const common = () => ({
  institution_id: f.a,
  student_id: users.student.id,
  program_id: program,
  academic_year_id: f.yearA,
  study_year: 1,
  student_number: "DEMO-" + randomUUID().slice(0, 8),
  status: "active",
});
const decision = (role, revision, status, checks = true) =>
  db[role].rpc("complete_enrollment", {
    target: study,
    expected_revision: revision,
    next_status: status,
    identity_checked: checks,
    documents_checked: checks,
    curriculum_checked: checks,
    financing_checked: checks,
    reason: "Provjera isključivo sintetskog studentskog upisa",
  });
const port = 3009,
  origin = `http://localhost:${port}`;
const request = (path, data, cookie = "") =>
  fetch(`${origin}${path}`, {
    method: data ? "POST" : "GET",
    redirect: "manual",
    headers: {
      origin,
      cookie,
      ...(data ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: data ? new URLSearchParams(data) : undefined,
  });
try {
  program = (
    await ok(
      service
        .from("study_programs")
        .insert({
          institution_id: f.a,
          name: "Sintetska provjera upisa",
          code: "EC-" + randomUUID().slice(0, 8),
          degree: "Stručni",
          duration_years: 3,
        })
        .select("id")
        .single(),
    )
  ).id;
  course = (
    await ok(
      service
        .from("courses")
        .insert({
          institution_id: f.a,
          program_id: program,
          semester_id: f.semesterA,
          name: "Provjera predmetnika",
          code: "EC-" + randomUUID().slice(0, 8),
          ects: 6,
        })
        .select("id")
        .single(),
    )
  ).id;
  const created = await ok(
    db.admin.from("student_studies").insert(common()).select("*").single(),
  );
  study = created.id;
  const time = new Date(Date.now() + 86400000).toISOString();
  exam = (
    await ok(
      db.admin
        .from("exams")
        .insert({
          institution_id: f.a,
          course_id: course,
          room_id: f.roomA,
          starts_at: time,
          registration_deadline: time,
          withdrawal_deadline: time,
          capacity: 10,
        })
        .select("id")
        .single(),
    )
  ).id;
  await ok(
    db.admin.rpc("transition_exam", {
      target: exam,
      expected_status: "draft",
      next_status: "open",
      reason: "Otvaranje sintetskog ispitnog roka",
    }),
  );
  await check(
    "new studies start as drafts and completion fields cannot be forged",
    async () => {
      assert.equal(created.completion_status, "draft");
      assert.equal(created.completed_by, null);
      await no(
        db.admin
          .from("student_studies")
          .update({ completion_status: "completed", identity_verified: true })
          .eq("id", study),
      );
      await no(decision("admin", 0, "completed"));
      await no(decision("student", 0, "pending_verification"));
      await no(decision("nastavnik", 0, "pending_verification"));
      await no(decision("student2", 0, "pending_verification"));
    },
  );
  await check(
    "completion requires all attestations, actual courses and current revision",
    async () => {
      await ok(decision("referada", 0, "pending_verification", false));
      await no(decision("referada", 0, "completed"));
      await no(decision("referada", 1, "completed", false));
      await no(decision("referada", 1, "completed", true));
      enrollment = (
        await ok(
          db.admin
            .from("course_enrollments")
            .insert({
              institution_id: f.a,
              study_id: study,
              course_id: course,
              student_id: users.student.id,
            })
            .select("id")
            .single(),
        )
      ).id;
      await no(db.student.rpc("register_exam", { target: exam }));
    },
  );
  laterYear = (
    await ok(
      service
        .from("academic_years")
        .insert({
          institution_id: f.a,
          name: "Sintetska iduća " + randomUUID().slice(0, 8),
          starts_on: "2045-10-01",
          ends_on: "2046-09-30",
        })
        .select("id")
        .single(),
    )
  ).id;
  await check(
    "unfinished prior enrollment blocks a later year through direct PostgREST",
    async () => {
      const r = await no(
        db.admin
          .from("student_studies")
          .insert({ ...common(), academic_year_id: laterYear, study_year: 2 }),
      );
      assert.equal(r.message, "Prethodni upis nije administrativno dovršen.");
    },
  );
  await check(
    "completion atomically records staff verification and enables exam registration and next year",
    async () => {
      const attempts = await Promise.all([
        decision("admin", 1, "completed"),
        decision("referada", 1, "completed"),
      ]);
      assert.equal(attempts.filter((r) => !r.error).length, 1);
      assert.equal(attempts.filter((r) => r.error).length, 1);
      const row = await ok(
        db.student.from("student_studies").select("*").eq("id", study).single(),
      );
      assert.equal(row.completion_status, "completed");
      assert.ok(row.completed_at);
      assert.ok([users.admin.id, users.referada.id].includes(row.completed_by));
      await ok(db.student.rpc("register_exam", { target: exam }));
      laterStudy = (
        await ok(
          db.admin
            .from("student_studies")
            .insert({ ...common(), academic_year_id: laterYear, study_year: 2 })
            .select("id")
            .single(),
        )
      ).id;
    },
  );
  await check(
    "completed enrollment and course list are protected until explicitly reopened",
    async () => {
      await no(
        db.admin
          .from("student_studies")
          .update({ student_number: "FORGED" })
          .eq("id", study),
      );
      await no(
        db.admin.from("course_enrollments").delete().eq("id", enrollment),
      );
      await no(db.admin.from("student_studies").delete().eq("id", study));
      await ok(decision("referada", 2, "pending_verification"));
      await ok(db.student.rpc("register_exam", { target: exam, cancel: true }));
      await no(db.student.rpc("register_exam", { target: exam }));
    },
  );
  await check(
    "review history is staff-only, immutable through user API and tenant scoped",
    async () => {
      const events = await ok(
        db.admin
          .from("enrollment_completion_events")
          .select("*")
          .eq("study_id", study),
      );
      assert.equal(events.length, 3);
      assert.deepEqual(
        await ok(
          db.student
            .from("enrollment_completion_events")
            .select("*")
            .eq("study_id", study),
        ),
        [],
      );
      assert.deepEqual(
        await ok(
          db.student2.from("student_studies").select("*").eq("id", study),
        ),
        [],
      );
      await no(
        db.admin
          .from("enrollment_completion_events")
          .delete()
          .eq("study_id", study),
      );
    },
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: c.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: c.ANON_KEY,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await request("/")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready);
  const cookies = {};
  for (const role of ["student", "admin"]) {
    const r = await request("/api/auth/login", {
      email: users[role].email,
      password: users[role].password,
      next: "studomat",
    });
    assert.equal(r.status, 303);
    cookies[role] = r.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
  }
  await check(
    "student sees completion reasons; staff sees actionable checklist; web API enforces role",
    async () => {
      const student = await request(
        `/?module=studomat&view=${encodeURIComponent("Dovršenost upisa")}&institution=${f.a}`,
        null,
        cookies.student,
      );
      assert.equal(student.status, 200);
      const own = await student.text();
      assert.ok(own.includes("Prijava ispita je blokirana"));
      assert.ok(!own.includes('action="/api/academic/complete-enrollment"'));
      const admin = await request(
        `/?module=isvu&view=${encodeURIComponent("Studenti i upisi")}&institution=${f.a}`,
        null,
        cookies.admin,
      );
      assert.equal(admin.status, 200);
      assert.ok((await admin.text()).includes("Kontrolna lista referade"));
      const fields = {
        institution_id: f.a,
        study_id: study,
        expected_revision: "3",
        next_status: "completed",
        reason: "Provjera sintetskog upisa kroz web obrazac",
        identity_checked: "on",
        documents_checked: "on",
        curriculum_checked: "on",
        financing_checked: "on",
        return_module: "isvu",
        return_view: "Studenti i upisi",
      };
      assert.equal(
        (
          await request(
            "/api/academic/complete-enrollment",
            fields,
            cookies.student,
          )
        ).status,
        403,
      );
      const done = await request(
        "/api/academic/complete-enrollment",
        fields,
        cookies.admin,
      );
      assert.equal(done.status, 303);
      assert.ok(done.headers.get("location").includes("status=saved"));
      const stale = await request(
        "/api/academic/complete-enrollment",
        fields,
        cookies.admin,
      );
      assert.ok(
        stale.headers.get("location").includes("status=enrollment-stale"),
      );
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE) {
    await check(
      "Chromium staff checklist saves, reopens and completes through actual form navigation",
      async () => {
        const { chromium } = await import(
          process.env.WORKFLOW_PLAYWRIGHT_MODULE
        );
        const browser = await chromium.launch({
          executablePath: "/usr/bin/chromium",
          headless: true,
          args: ["--no-sandbox"],
        });
        try {
          const page = await browser.newPage({
            viewport: { width: 1440, height: 1000 },
          });
          await page.goto(`${origin}/?module=auth&next=isvu`);
          await page.locator('input[name="email"]').fill(users.admin.email);
          await page
            .locator('input[name="password"]')
            .fill(users.admin.password);
          await Promise.all([
            page.waitForNavigation(),
            page
              .getByRole("button", { name: "Prijavi se", exact: true })
              .click(),
          ]);
          const url = `${origin}/?module=isvu&view=${encodeURIComponent("Studenti i upisi")}&institution=${f.a}`;
          await page.goto(url);
          const record = page
            .locator("details")
            .filter({
              has: page.locator(`input[name="study_id"][value="${study}"]`),
            });
          await record.locator(":scope > summary").click();
          await record
            .locator('textarea[name="reason"]')
            .fill("Ponovna provjera sintetskog upisa u pregledniku");
          await Promise.all([
            page.waitForNavigation(),
            record
              .getByRole("button", {
                name: "Ponovno otvori provjeru",
                exact: true,
              })
              .click(),
          ]);
          await record.locator(":scope > summary").click();
          await record
            .getByText("Kontrolna lista referade", { exact: true })
            .waitFor();
          assert.equal(
            (
              await ok(
                db.student
                  .from("student_studies")
                  .select("completion_status")
                  .eq("id", study)
                  .single(),
              )
            ).completion_status,
            "pending_verification",
          );
          const studentPage = await browser.newPage({
            viewport: { width: 390, height: 844 },
          });
          await studentPage.goto(`${origin}/?module=auth&next=studomat`);
          await studentPage
            .locator('input[name="email"]')
            .fill(users.student.email);
          await studentPage
            .locator('input[name="password"]')
            .fill(users.student.password);
          await Promise.all([
            studentPage.waitForNavigation(),
            studentPage
              .getByRole("button", { name: "Prijavi se", exact: true })
              .click(),
          ]);
          await studentPage.goto(
            `${origin}/?module=studomat&view=${encodeURIComponent("Dovršenost upisa")}&institution=${f.a}`,
          );
          await studentPage
            .getByText(
              "Prijava ispita je blokirana do administrativnog dovršenja upisa. Provjeru provodi referada.",
              { exact: true },
            )
            .first()
            .waitFor();
          await studentPage.screenshot({
            path: "/tmp/isvu-student-upis.png",
            fullPage: true,
          });
          await page.screenshot({
            path: "/tmp/isvu-referada-upis.png",
            fullPage: true,
          });
          await page.goto(url);
          await record.locator(":scope > summary").click();
          for (const field of [
            "identity_checked",
            "documents_checked",
            "curriculum_checked",
            "financing_checked",
          ])
            await record.locator(`input[name="${field}"]`).check();
          await record
            .locator('select[name="next_status"]')
            .selectOption("completed");
          await record
            .locator('textarea[name="reason"]')
            .fill("Potvrđena kontrolna lista sintetskog upisa u pregledniku");
          await Promise.all([
            page.waitForNavigation(),
            record
              .getByRole("button", {
                name: "Spremi odluku referade",
                exact: true,
              })
              .click(),
          ]);
          assert.equal(
            (
              await ok(
                db.student
                  .from("student_studies")
                  .select("completion_status")
                  .eq("id", study)
                  .single(),
              )
            ).completion_status,
            "completed",
          );
        } finally {
          await browser.close();
        }
      },
    );
  }
  console.log(
    `${count} enrollment-completion integration scenarios passed against local Auth, PostgREST, PostgreSQL and Next.js.`,
  );
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => {
      if (server.exitCode !== null) r();
      else server.once("exit", r);
    });
  }
  if (exam) {
    await ok(service.from("exam_registrations").delete().eq("exam_id", exam));
    await ok(service.from("exam_workflow_events").delete().eq("exam_id", exam));
    await ok(service.from("exams").delete().eq("id", exam));
  }
  if (laterStudy)
    await ok(service.from("student_studies").delete().eq("id", laterStudy));
  if (study) {
    const row = await ok(
      service
        .from("student_studies")
        .select("completion_status,completion_revision")
        .eq("id", study)
        .single(),
    );
    if (row.completion_status === "completed")
      await ok(
        decision("admin", row.completion_revision, "pending_verification"),
      );
    await ok(
      service
        .from("enrollment_completion_events")
        .delete()
        .eq("study_id", study),
    );
  }
  if (enrollment)
    await ok(service.from("course_enrollments").delete().eq("id", enrollment));
  if (study) await ok(service.from("student_studies").delete().eq("id", study));
  if (course) await ok(service.from("courses").delete().eq("id", course));
  if (program)
    await ok(service.from("study_programs").delete().eq("id", program));
  if (laterYear)
    await ok(service.from("academic_years").delete().eq("id", laterYear));
}
