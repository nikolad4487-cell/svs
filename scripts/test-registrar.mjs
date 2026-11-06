import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(c.API_URL).hostname));
const f = JSON.parse(readFileSync(".local-academic.json")),
  users = JSON.parse(readFileSync(".local-test-users.json"));
const service = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }),
  db = {};
for (const role of ["referada", "admin", "nastavnik", "student2"]) {
  const actor = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert.ifError((await actor.auth.signInWithPassword(users[role])).error);
  db[role] = actor;
}
const ok = async (q) => {
  const r = await q;
  assert.ifError(r.error);
  return r.data;
};
const no = async (q) => {
  const r = await q;
  assert.ok(r.error, "Expected denial");
  return r.error;
};
const created = {
  programs: [],
  courses: [],
  cases: [],
  semesters: [],
  years: [],
  exams: [],
  invites: [],
  accounts: [],
};
const email = `registrar-${randomUUID()}@example.test`,
  password = randomBytes(24).toString("base64url");
let student,
  server,
  prevYear,
  prevSemester,
  count = 0;
const check = async (label, run) => {
  await run();
  console.log(`PASS ${label}`);
  count++;
};
const recordData = {
  legal_name: "Sintetski Student Referade",
  birth_date: "2005-01-01",
  citizenship: "DEMO",
  jmbag: "",
  oib: "",
  identity_reference: "",
};
const reason = "Provjera isključivo sintetskog upisnog postupka";
const port = 3010,
  origin = `http://localhost:${port}`;
const request = (path, body, cookie = "", json = false) =>
  fetch(`${origin}${path}`, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      origin,
      cookie,
      ...(body
        ? {
            "content-type": json
              ? "application/json"
              : "application/x-www-form-urlencoded",
          }
        : {}),
    },
    body: body
      ? json
        ? JSON.stringify(body)
        : new URLSearchParams(body)
      : undefined,
  });
try {
  student = (
    await ok(
      service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: recordData.legal_name },
      }),
    )
  ).user.id;
  await ok(
    service
      .from("memberships")
      .insert({ institution_id: f.a, user_id: student, role: "student" }),
  );
  db.student = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  await ok(db.student.auth.signInWithPassword({ email, password }));
  await check(
    "registrar can see own student roster before any study, never another institution",
    async () => {
      assert.equal(
        (
          await ok(
            db.referada.from("memberships").select("*").eq("user_id", student),
          )
        ).length,
        1,
      );
      assert.equal(
        (await ok(db.referada.from("profiles").select("id").eq("id", student)))
          .length,
        1,
      );
      await no(
        db.referada.rpc("registrar_save_record", {
          inst: f.b,
          target: users.student2.id,
          expected_revision: 0,
          data: recordData,
        }),
      );
      await no(
        db.student.rpc("registrar_save_record", {
          inst: f.a,
          target: student,
          expected_revision: 0,
          data: recordData,
        }),
      );
      await no(
        db.nastavnik.rpc("registrar_save_record", {
          inst: f.a,
          target: student,
          expected_revision: 0,
          data: recordData,
        }),
      );
      const change = await db.referada
        .from("memberships")
        .update({ role: "institution_admin" })
        .eq("user_id", student)
        .select();
      assert.ok(change.error || change.data.length === 0);
    },
  );
  await check(
    "minimal Auth roster is restricted to staff in the selected institution",
    async () => {
      const roster = await ok(
        db.referada.rpc("registrar_student_roster", { inst: f.a }),
      );
      assert.ok(roster.some((r) => r.id === student && r.email === email));
      await no(db.student.rpc("registrar_student_roster", { inst: f.a }));
      await no(db.nastavnik.rpc("registrar_student_roster", { inst: f.a }));
      await no(db.referada.rpc("registrar_student_roster", { inst: f.b }));
    },
  );
  await check(
    "official dossier generates a local number, preserves identity and rejects stale writes",
    async () => {
      await ok(
        db.referada.rpc("registrar_save_record", {
          inst: f.a,
          target: student,
          expected_revision: 0,
          data: recordData,
        }),
      );
      const row = await ok(
        db.student
          .from("student_records")
          .select("*")
          .eq("student_id", student)
          .single(),
      );
      assert.match(row.local_number, /^LOC-/);
      assert.equal(row.jmbag, "");
      assert.equal(row.oib, "");
      await no(
        db.referada.rpc("registrar_save_record", {
          inst: f.a,
          target: student,
          expected_revision: 0,
          data: recordData,
        }),
      );
      assert.deepEqual(
        await ok(
          db.student2
            .from("student_records")
            .select("*")
            .eq("student_id", student),
        ),
        [],
      );
      assert.deepEqual(
        await ok(
          db.nastavnik
            .from("student_records")
            .select("*")
            .eq("student_id", student),
        ),
        [],
      );
      await no(
        db.student
          .from("student_records")
          .update({ legal_name: "Krivotvoren zapis" })
          .eq("id", row.id),
      );
    },
  );
  prevYear = (
    await ok(
      service
        .from("academic_years")
        .insert({
          institution_id: f.a,
          name: "DEMO prethodna " + randomUUID().slice(0, 8),
          starts_on: "2025-10-01",
          ends_on: "2026-09-30",
        })
        .select("id")
        .single(),
    )
  ).id;
  created.years.push(prevYear);
  prevSemester = (
    await ok(
      service
        .from("semesters")
        .insert({
          institution_id: f.a,
          academic_year_id: prevYear,
          name: "DEMO zimski",
          starts_on: "2025-10-01",
          ends_on: "2026-02-01",
        })
        .select("id")
        .single(),
    )
  ).id;
  created.semesters.push(prevSemester);
  let firstCase, firstStudy, firstCourse;
  for (const kind of [
    "first_matura",
    "first_selection",
    "next_year",
    "repeat",
    "transfer",
    "parallel",
    "postgraduate",
    "continuation",
  ]) {
    await check(
      `${kind}: staff prepares, verifies and atomically creates a draft annual enrollment`,
      async () => {
        const program = (
          await ok(
            service
              .from("study_programs")
              .insert({
                institution_id: f.a,
                name: `DEMO ${kind}`,
                code: "RF-" + randomUUID().slice(0, 8),
                degree:
                  kind === "postgraduate" ? "Poslijediplomski" : "Stručni",
                duration_years: 4,
              })
              .select("id")
              .single(),
          )
        ).id;
        created.programs.push(program);
        const course = (
          await ok(
            service
              .from("courses")
              .insert({
                institution_id: f.a,
                program_id: program,
                semester_id: f.semesterA,
                name: `DEMO kolegij ${kind}`,
                code: "RF-" + randomUUID().slice(0, 8),
                ects: 6,
              })
              .select("id")
              .single(),
          )
        ).id;
        created.courses.push(course);
        let previous = null;
        if (["next_year", "repeat", "continuation"].includes(kind)) {
          const prevCourse = (
            await ok(
              service
                .from("courses")
                .insert({
                  institution_id: f.a,
                  program_id: program,
                  semester_id: prevSemester,
                  name: "DEMO prethodni kolegij",
                  code: "RF-" + randomUUID().slice(0, 8),
                  ects: 6,
                })
                .select("id")
                .single(),
            )
          ).id;
          created.courses.push(prevCourse);
          previous = (
            await ok(
              db.referada
                .from("student_studies")
                .insert({
                  institution_id: f.a,
                  student_id: student,
                  program_id: program,
                  academic_year_id: prevYear,
                  study_year: 1,
                  student_number: "DEMO-PREV",
                  status: "active",
                })
                .select("id")
                .single(),
            )
          ).id;
          await ok(
            db.referada.from("course_enrollments").insert({
              institution_id: f.a,
              study_id: previous,
              student_id: student,
              course_id: prevCourse,
            }),
          );
          for (const [revision, status] of [
            [0, "pending_verification"],
            [1, "completed"],
          ])
            await ok(
              db.referada.rpc("complete_enrollment", {
                target: previous,
                expected_revision: revision,
                next_status: status,
                identity_checked: true,
                documents_checked: true,
                curriculum_checked: true,
                financing_checked: true,
                reason,
              }),
            );
        }
        const data = {
          student_id: student,
          program_id: program,
          academic_year_id: f.yearA,
          kind,
          study_year: kind === "next_year" ? 2 : 1,
          mode: "full_time",
          financing: "DEMO odluka ustanove",
          admission_number: "DEMO-UP-" + kind,
          decision_reference: "DEMO-ODLUKA",
          source_institution:
            kind === "transfer" ? "DEMO vanjsko učilište" : "",
          previous_study_id: previous,
          winter_semester: kind === "postgraduate" ? 1 : null,
          summer_semester: kind === "postgraduate" ? 2 : null,
        };
        const id = await ok(
          db.referada.rpc("registrar_save_case", {
            inst: f.a,
            target: null,
            expected_revision: 0,
            data,
            reason,
          }),
        );
        created.cases.push(id);
        if (kind === "first_matura") {
          firstCase = id;
          firstCourse = course;
          await no(
            db.student.rpc("registrar_decide_case", {
              target: id,
              expected_revision: 1,
              next_state: "approved",
              checks: {},
              reason,
            }),
          );
          await no(
            db.nastavnik.rpc("registrar_enroll_case", {
              target: id,
              expected_revision: 1,
              selected_courses: [course],
              reason,
            }),
          );
          await no(
            db.referada.rpc("registrar_decide_case", {
              target: id,
              expected_revision: 1,
              next_state: "approved",
              checks: { documents_verified: true, conditions_verified: true },
              reason,
            }),
          );
        }
        const checks = {
          documents_verified: true,
          conditions_verified: true,
          matura_verified: true,
          qualification_verified: true,
        };
        await ok(
          db.referada.rpc("registrar_decide_case", {
            target: id,
            expected_revision: 1,
            next_state: "approved",
            checks,
            reason,
          }),
        );
        await no(
          db.referada.rpc("registrar_enroll_case", {
            target: id,
            expected_revision: 2,
            selected_courses: [course, f.courseB],
            reason,
          }),
        );
        assert.equal(
          (
            await ok(
              service
                .from("student_studies")
                .select("id")
                .eq("student_id", student)
                .eq("program_id", program)
                .eq("academic_year_id", f.yearA),
            )
          ).length,
          0,
        );
        const attempts = await Promise.all([
          db.referada.rpc("registrar_enroll_case", {
            target: id,
            expected_revision: 2,
            selected_courses: [course],
            reason,
          }),
          db.admin.rpc("registrar_enroll_case", {
            target: id,
            expected_revision: 2,
            selected_courses: [course],
            reason,
          }),
        ]);
        assert.equal(attempts.filter((r) => !r.error).length, 1);
        assert.equal(attempts.filter((r) => r.error).length, 1);
        const row = await ok(
          db.student
            .from("student_studies")
            .select("*")
            .eq("student_id", student)
            .eq("program_id", program)
            .eq("academic_year_id", f.yearA)
            .single(),
        );
        assert.equal(row.completion_status, "draft");
        assert.equal(
          row.student_number,
          (
            await ok(
              db.student
                .from("student_records")
                .select("local_number")
                .eq("student_id", student)
                .single(),
            )
          ).local_number,
        );
        if (kind === "first_matura") firstStudy = row.id;
        assert.equal(
          (
            await ok(
              db.referada
                .from("registrar_case_events")
                .select("id")
                .eq("case_id", id),
            )
          ).length,
          3,
        );
        assert.deepEqual(
          await ok(
            db.student
              .from("registrar_enrollment_cases")
              .select("*")
              .eq("id", id),
          ),
          [],
        );
      },
    );
  }
  await check(
    "official annual addresses are staff-controlled and independent of self-reported data",
    async () => {
      const row = await ok(
        db.student
          .from("student_year_records")
          .select("*")
          .eq("student_id", student)
          .eq("academic_year_id", f.yearA)
          .single(),
      );
      await ok(
        db.referada.rpc("registrar_save_year", {
          inst: f.a,
          target: student,
          year_id: f.yearA,
          expected_revision: row.revision,
          data: {
            residence_city: "DEMO Zagreb",
            residence_address: "DEMO ulica 1",
            residence_confirmation_date: "2026-10-01",
          },
        }),
      );
      await no(
        db.student.rpc("registrar_save_year", {
          inst: f.a,
          target: student,
          year_id: f.yearA,
          expected_revision: row.revision + 1,
          data: { residence_city: "FORGED" },
        }),
      );
      assert.deepEqual(
        await ok(
          db.nastavnik
            .from("student_year_records")
            .select("*")
            .eq("student_id", student),
        ),
        [],
      );
      assert.equal(
        (
          await ok(
            db.student
              .from("student_year_records")
              .select("*")
              .eq("student_id", student)
              .eq("academic_year_id", f.yearA)
              .single(),
          )
        ).details.residence_city,
        "DEMO Zagreb",
      );
    },
  );
  const future = new Date(Date.now() + 86400000).toISOString();
  const exam = (
    await ok(
      db.referada
        .from("exams")
        .insert({
          institution_id: f.a,
          course_id: firstCourse,
          room_id: f.roomA,
          starts_at: future,
          registration_deadline: future,
          withdrawal_deadline: future,
          capacity: 10,
        })
        .select("id")
        .single(),
    )
  ).id;
  created.exams.push(exam);
  await ok(
    db.referada.rpc("transition_exam", {
      target: exam,
      expected_status: "draft",
      next_status: "open",
      reason,
    }),
  );
  await check(
    "issued enrollment stays blocked until referada completes the annual checklist",
    async () => {
      await no(db.student.rpc("register_exam", { target: exam }));
      for (const [revision, status] of [
        [0, "pending_verification"],
        [1, "completed"],
      ])
        await ok(
          db.referada.rpc("complete_enrollment", {
            target: firstStudy,
            expected_revision: revision,
            next_status: status,
            identity_checked: true,
            documents_checked: true,
            curriculum_checked: true,
            financing_checked: true,
            reason,
          }),
        );
      await ok(db.student.rpc("register_exam", { target: exam }));
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
        SVS_SUPABASE_URL: c.API_URL,
        SVS_SUPABASE_SECRET_KEY: c.SERVICE_ROLE_KEY,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  for (let n = 0; n < 100; n++) {
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
  for (const role of ["referada", "student"]) {
    const u = role === "student" ? { email, password } : users.referada;
    const res = await request("/api/auth/login", {
      email: u.email,
      password: u.password,
      next: role === "referada" ? "referada" : "studomat",
    });
    assert.equal(res.status, 303);
    cookies[role] = res.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  }
  await check(
    "web routes expose registrar workflows and student read-only records with tenant checks",
    async () => {
      for (const view of [
        "Pregled",
        "Upisni postupci",
        "Uvoz upisa",
        "Studenti i dosjei",
        "Studenti i upisi",
        "Studentske evidencije",
        "Grupe studenata",
      ]) {
        const page = await request(
          `/?module=referada&view=${encodeURIComponent(view)}&institution=${f.a}&student=${student}`,
          null,
          cookies.referada,
        );
        assert.equal(page.status, 200, view);
        const html = await page.text();
        assert.ok(!html.includes("Pristup nije dopušten"), view);
      }
      const wrong = await request(
        `/?module=referada&institution=${f.b}`,
        null,
        cookies.referada,
      );
      assert.ok([200, 404].includes(wrong.status));
      assert.match(await wrong.text(), /404|NEXT_HTTP_ERROR_FALLBACK/);
      const pupil = await request("/?module=referada", null, cookies.student);
      assert.ok((await pupil.text()).includes("Pristup nije dopušten"));
      const own = await request(
        "/?module=studomat&view=" +
          encodeURIComponent("Službeni godišnji podaci") +
          "&institution=" +
          f.a,
        null,
        cookies.student,
      );
      assert.ok((await own.text()).includes("DEMO Zagreb"));
      const denied = await request(
        "/api/registrar/record",
        {
          institution_id: f.a,
          student_id: student,
          expected_revision: 1,
          ...recordData,
        },
        cookies.student,
      );
      assert.equal(denied.status, 403);
      const catalog = await request(
        "/api/admissions/target-catalog",
        {},
        cookies.referada,
        true,
      );
      assert.equal(catalog.status, 200);
      assert.ok((await catalog.json()).institutions.every((i) => i.id === f.a));
    },
  );
  await check(
    "registrar creates student-only access, prints once without email and cannot activate staff invitations",
    async () => {
      const alias = `referada-access-${randomUUID()}@example.test`;
      const invite = await request(
        "/api/registrar/invite",
        { institution_id: f.a, return_view: "Upisni postupci", email: alias },
        cookies.referada,
      );
      assert.equal(invite.status, 303);
      assert.ok(invite.headers.get("location").includes("status=saved"));
      const row = await ok(
        service
          .from("registration_invites")
          .select("id")
          .eq("email", alias)
          .single(),
      );
      created.invites.push(row.id);
      const attempts = await Promise.all([
        request(
          "/api/admin/pending-credentials",
          { invite_id: row.id, activate: true },
          cookies.referada,
          true,
        ),
        request(
          "/api/admin/pending-credentials",
          { invite_id: row.id, activate: true },
          cookies.referada,
          true,
        ),
      ]);
      assert.equal(attempts.filter((r) => r.status === 200).length, 1);
      assert.equal(attempts.filter((r) => r.status === 409).length, 1);
      const issued = await attempts.find((r) => r.status === 200).json();
      created.accounts.push(issued.userId);
      assert.ok(issued.sheet.password.length >= 20);
      assert.equal(issued.sheet.email, alias);
      const fresh = createClient(c.API_URL, c.ANON_KEY, {
        auth: { persistSession: false },
      });
      const session = await ok(
        fresh.auth.signInWithPassword({
          email: alias,
          password: issued.sheet.password,
        }),
      );
      assert.equal(
        session.user.app_metadata.svs_password_change_required,
        true,
      );
      assert.deepEqual(
        (
          await ok(
            service
              .from("memberships")
              .select("role")
              .eq("user_id", issued.userId),
          )
        ).map((r) => r.role),
        ["student"],
      );
      const staffEmail = `protected-staff-${randomUUID()}@example.test`;
      for (const role of ["student", "institution_admin"]) {
        const v = await ok(
          service
            .from("registration_invites")
            .insert({ institution_id: f.a, email: staffEmail, role })
            .select("id")
            .single(),
        );
        created.invites.push(v.id);
      }
      await no(
        db.referada.rpc("claim_pending_credentials", {
          invite_id: created.invites.at(-2),
        }),
      );
      assert.equal(
        (
          await request(
            "/api/admin/pending-credentials",
            { invite_id: created.invites.at(-1), activate: true },
            cookies.referada,
            true,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "/api/admin/pending-credentials",
            { invite_id: row.id, activate: true },
            cookies.student,
            true,
          )
        ).status,
        403,
      );
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE) {
    await check(
      "Chromium registrar can save official annual data; student sees it without edit controls",
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
          await page.goto(origin + "/?module=auth&next=referada");
          await page.locator("input[name=email]").fill(users.referada.email);
          await page
            .locator("input[name=password]")
            .fill(users.referada.password);
          await Promise.all([
            page.waitForNavigation(),
            page
              .getByRole("button", { name: "Prijavi se", exact: true })
              .click(),
          ]);
          await page.goto(
            `${origin}/?module=referada&view=${encodeURIComponent("Studenti i dosjei")}&institution=${f.a}&student=${student}`,
          );
          const year = page.locator("details").filter({
            has: page.locator(
              `input[name=academic_year_id][value="${f.yearA}"]`,
            ),
          });
          await year.locator(":scope > summary").click();
          await year
            .locator("input[name=residence_city]")
            .fill("DEMO Karlovac");
          await Promise.all([
            page.waitForNavigation(),
            year
              .getByRole("button", {
                name: "Spremi službene godišnje podatke",
                exact: true,
              })
              .click(),
          ]);
          assert.equal(
            (
              await ok(
                db.student
                  .from("student_year_records")
                  .select("details")
                  .eq("student_id", student)
                  .eq("academic_year_id", f.yearA)
                  .single(),
              )
            ).details.residence_city,
            "DEMO Karlovac",
          );
          await page.goto(
            `${origin}/?module=referada&view=${encodeURIComponent("Upisni postupci")}&institution=${f.a}`,
          );
          await page
            .getByRole("heading", {
              name: "Novi upisni postupak referade",
              exact: true,
            })
            .waitFor();
          const program = (
            await ok(
              service
                .from("study_programs")
                .insert({
                  institution_id: f.a,
                  name: "DEMO preglednički upis",
                  code: "UI-" + randomUUID().slice(0, 8),
                  degree: "Stručni",
                  duration_years: 3,
                })
                .select("id")
                .single(),
            )
          ).id;
          created.programs.push(program);
          const course = (
            await ok(
              service
                .from("courses")
                .insert({
                  institution_id: f.a,
                  program_id: program,
                  semester_id: f.semesterA,
                  name: "DEMO kolegij preglednika",
                  code: "UI-" + randomUUID().slice(0, 8),
                  ects: 6,
                })
                .select("id")
                .single(),
            )
          ).id;
          created.courses.push(course);
          await page.reload();
          await page
            .getByRole("heading", {
              name: "Novi upisni postupak referade",
              exact: true,
            })
            .waitFor();
          await page.getByText("Otvori novi postupak", { exact: true }).click();
          const form = page
            .locator('form[action="/api/registrar/case"]')
            .first();
          await form.locator('select[name="student_id"]').selectOption(student);
          await form.locator('select[name="program_id"]').selectOption(program);
          await form
            .locator('select[name="academic_year_id"]')
            .selectOption(f.yearA);
          await form
            .locator('select[name="kind"]')
            .selectOption("first_selection");
          await form
            .locator('input[name="financing"]')
            .fill("DEMO financiranje");
          await form
            .locator('input[name="admission_number"]')
            .fill("DEMO-UP-UI");
          await form
            .locator('input[name="decision_reference"]')
            .fill("DEMO-ODLUKA-UI");
          await form
            .locator('textarea[name="reason"]')
            .fill("Priprema sintetskog upisa kroz preglednik");
          await Promise.all([
            page.waitForNavigation(),
            form
              .getByRole("button", {
                name: "Otvori upisni postupak",
                exact: true,
              })
              .click(),
          ]);
          const entry = await ok(
            service
              .from("registrar_enrollment_cases")
              .select("id")
              .eq("program_id", program)
              .single(),
          );
          created.cases.push(entry.id);
          const row = page
            .locator("details")
            .filter({
              has: page.locator(`input[name="case_id"][value="${entry.id}"]`),
            });
          await row.locator(":scope > summary").click();
          const approval = row
            .locator('form[action="/api/registrar/decision"]')
            .filter({
              has: page.locator('input[name="next_state"][value="approved"]'),
            });
          for (const name of [
            "documents_verified",
            "conditions_verified",
            "qualification_verified",
          ])
            await approval.locator(`input[name="${name}"]`).check();
          await approval
            .locator('textarea[name="reason"]')
            .fill("Provjereni dokumenti i prethodna kvalifikacija DEMO");
          await Promise.all([
            page.waitForNavigation(),
            approval
              .getByRole("button", {
                name: "Odobri izradu upisnog lista",
                exact: true,
              })
              .click(),
          ]);
          await row.locator(":scope > summary").click();
          const enroll = row.locator('form[action="/api/registrar/enroll"]');
          await enroll
            .locator(`input[name="course_id"][value="${course}"]`)
            .check();
          await enroll
            .locator('textarea[name="reason"]')
            .fill("Sastavljen sintetski upisni list s kolegijem");
          await Promise.all([
            page.waitForNavigation(),
            enroll
              .getByRole("button", { name: "Izradi upisni list", exact: true })
              .click(),
          ]);
          assert.equal(
            (
              await ok(
                service
                  .from("registrar_enrollment_cases")
                  .select("state")
                  .eq("id", entry.id)
                  .single(),
              )
            ).state,
            "enrolled",
          );
          await page
            .getByRole("heading", {
              name: "Novi upisni postupak referade",
              exact: true,
            })
            .waitFor();
          await page.screenshot({
            path: "/tmp/isvu-referada-postupci.png",
            fullPage: true,
          });
        } finally {
          await browser.close();
        }
      },
    );
  }
  console.log(
    `${count} registrar scenarios passed, including all eight enrollment kinds.`,
  );
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => {
      if (server.exitCode !== null) r();
      else server.once("exit", r);
    });
  }
  for (const id of created.exams) {
    await ok(service.from("exam_registrations").delete().eq("exam_id", id));
    await ok(service.from("exam_workflow_events").delete().eq("exam_id", id));
    await ok(service.from("exams").delete().eq("id", id));
  }
  if (created.cases.length) {
    await ok(
      service
        .from("registrar_case_events")
        .delete()
        .in("case_id", created.cases),
    );
    await ok(
      service
        .from("registrar_enrollment_cases")
        .delete()
        .in("id", created.cases),
    );
  }
  if (student) {
    for (const s of await ok(
      service.from("student_studies").select("*").eq("student_id", student),
    ))
      if (s.completion_status === "completed")
        await ok(
          db.referada.rpc("complete_enrollment", {
            target: s.id,
            expected_revision: s.completion_revision,
            next_status: "pending_verification",
            identity_checked: true,
            documents_checked: true,
            curriculum_checked: true,
            financing_checked: true,
            reason,
          }),
        );
    for (const t of [
      "enrollment_completion_events",
      "student_year_records",
      "student_records",
      "course_enrollments",
      "student_studies",
    ])
      await ok(service.from(t).delete().eq("student_id", student));
  }
  for (const [table, ids] of [
    ["courses", created.courses],
    ["semesters", created.semesters],
    ["academic_years", created.years],
    ["study_programs", created.programs],
  ])
    if (ids.length) await ok(service.from(table).delete().in("id", ids));
  if (created.invites.length)
    await ok(
      service.from("registration_invites").delete().in("id", created.invites),
    );
  for (const id of created.accounts)
    await ok(service.auth.admin.deleteUser(id));
  if (student) await ok(service.auth.admin.deleteUser(student));
}
