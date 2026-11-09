import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["127.0.0.1", "localhost"].includes(new URL(c.API_URL).hostname));
const users = JSON.parse(readFileSync(".local-test-users.json"));
const f = JSON.parse(readFileSync(".local-academic.json"));
const client = (key = c.ANON_KEY) =>
  createClient(c.API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = client(c.SERVICE_ROLE_KEY),
  db = {},
  tag = randomUUID().slice(0, 8);
const ok = async (p) => {
  const r = await p;
  assert.ifError(r.error);
  return r.data;
};
let count = 0,
  server,
  membershipAdded = false,
  peerStudy,
  courseExtra,
  materials = [],
  assignments = [];
const check = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};
const denied = async (p, message) => {
  const r = await p;
  assert.ok(r.error, "operation must be rejected");
  if (message) assert.ok(r.error.message.includes(message), r.error.message);
};
const materialArgs = (course, published = true) => ({
  target_course: course,
  item_title: `Materijal ${tag}`,
  item_body: "Sadržaj materijala <b>doslovni tekst</b>",
  item_url: "",
  item_published: published,
});
const assignmentArgs = (published = true) => ({
  target_course: f.courseA,
  item_title: `Zadatak ${tag}`,
  item_instructions: "Napišite rješenje.",
  item_due: new Date(Date.now() + 86400000).toISOString(),
  item_max: 20,
  item_published: published,
  item_late: false,
});
const submitArgs = (target, expected = 0, answer = "Moje rješenje") => ({
  target,
  answer,
  answer_url: "",
  expected,
});
const createdMaterial = async (args, actor = db.nastavnik) => {
  const id = await ok(actor.rpc("learning_save_material", args));
  materials.push(id);
  return id;
};
const createdAssignment = async (args) => {
  const id = await ok(db.nastavnik.rpc("learning_save_assignment", args));
  assignments.push(id);
  return id;
};
const origin = "http://localhost:3012";
async function request(path, fields, cookie = "", extra = {}) {
  return fetch(origin + path, {
    method: fields ? "POST" : "GET",
    redirect: "manual",
    headers: {
      cookie,
      ...(fields
        ? { origin, "content-type": "application/x-www-form-urlencoded" }
        : {}),
      ...extra,
    },
    ...(fields ? { body: new URLSearchParams(fields) } : {}),
  });
}
async function login(role) {
  const r = await request("/api/auth/login", {
    email: users[role].email,
    password: users[role].password,
    next: "merlin",
  });
  assert.equal(r.status, 303);
  return r.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
}
try {
  for (const role of ["student", "student2", "admin", "nastavnik"]) {
    db[role] = client();
    await ok(
      db[role].auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      }),
    );
  }
  const baseCourse = await ok(
    service.from("courses").select("*").eq("id", f.courseA).single(),
  );
  courseExtra = randomUUID();
  await ok(
    service.from("courses").insert({
      id: courseExtra,
      institution_id: f.a,
      program_id: baseCourse.program_id,
      semester_id: baseCourse.semester_id,
      name: `Nepovezani kolegij ${tag}`,
      code: `LMS-${tag}`,
      ects: 2,
    }),
  );
  await check(
    "catalogue follows active student enrollment and assigned teacher, not institution membership alone",
    async () => {
      for (const role of ["student", "nastavnik"]) {
        const courses = await ok(db[role].rpc("learning_courses"));
        assert.ok(courses.some((x) => x.id === f.courseA));
        assert.ok(
          !courses.some((x) => [f.courseB, courseExtra].includes(x.id)),
        );
      }
      assert.ok(
        (await ok(db.admin.rpc("learning_courses"))).some(
          (x) => x.id === courseExtra,
        ),
      );
      await denied(client().rpc("learning_courses"));
    },
  );
  let publishedMaterial, draftMaterial, assignment;
  await check(
    "only course staff author materials; students see published items only",
    async () => {
      publishedMaterial = await createdMaterial(materialArgs(f.courseA));
      draftMaterial = await createdMaterial(materialArgs(f.courseA, false));
      const adminMaterial = await createdMaterial(
        materialArgs(courseExtra),
        db.admin,
      );
      assert.equal(
        (
          await ok(
            db.admin
              .from("learning_materials")
              .select("id")
              .eq("id", adminMaterial),
          )
        ).length,
        1,
      );
      await denied(
        db.student.rpc("learning_save_material", materialArgs(f.courseA)),
        "LEARNING_FORBIDDEN",
      );
      await denied(
        db.nastavnik.rpc("learning_save_material", materialArgs(f.courseB)),
        "LEARNING_FORBIDDEN",
      );
      await denied(
        db.nastavnik.rpc("learning_save_material", materialArgs(courseExtra)),
        "LEARNING_FORBIDDEN",
      );
      const rows = await ok(
        db.student.from("learning_materials").select("*").in("id", materials),
      );
      assert.deepEqual(
        rows.map((x) => x.id),
        [publishedMaterial],
      );
      assert.deepEqual(
        await ok(
          db.student2
            .from("learning_materials")
            .select("*")
            .in("id", materials),
        ),
        [],
      );
      await denied(
        db.nastavnik
          .from("learning_materials")
          .update({ published: true })
          .eq("id", draftMaterial),
      );
    },
  );
  await check(
    "material revisions reject stale concurrent edits and publish drafts",
    async () => {
      const args = {
        ...materialArgs(f.courseA),
        target: draftMaterial,
        expected: 1,
      };
      await ok(db.nastavnik.rpc("learning_save_material", args));
      await denied(
        db.nastavnik.rpc("learning_save_material", args),
        "LEARNING_CONFLICT",
      );
      assert.equal(
        (
          await ok(
            db.student
              .from("learning_materials")
              .select("id")
              .eq("id", draftMaterial),
          )
        ).length,
        1,
      );
    },
  );
  await check(
    "draft assignments cannot be submitted and deadlines are enforced by the database",
    async () => {
      const draft = await createdAssignment(assignmentArgs(false));
      await denied(
        db.student.rpc("learning_submit", submitArgs(draft)),
        "LEARNING_FORBIDDEN",
      );
      const closed = await createdAssignment({
        ...assignmentArgs(),
        item_due: new Date(Date.now() - 86400000).toISOString(),
      });
      await denied(
        db.student.rpc("learning_submit", submitArgs(closed)),
        "LEARNING_DEADLINE",
      );
      await ok(
        db.nastavnik.rpc("learning_save_assignment", {
          ...assignmentArgs(),
          target: closed,
          expected: 1,
          item_due: new Date(Date.now() - 86400000).toISOString(),
          item_late: true,
        }),
      );
      await ok(db.student.rpc("learning_submit", submitArgs(closed)));
    },
  );
  let submission;
  await check(
    "duplicate first submissions serialize and only one current revision is accepted",
    async () => {
      assignment = await createdAssignment(assignmentArgs());
      const results = await Promise.all([
        db.student.rpc("learning_submit", submitArgs(assignment)),
        db.student.rpc("learning_submit", submitArgs(assignment)),
      ]);
      assert.equal(results.filter((r) => !r.error).length, 1);
      assert.ok(
        results
          .find((r) => r.error)
          .error.message.includes("LEARNING_CONFLICT"),
      );
      submission = results.find((r) => !r.error).data;
      await ok(
        db.student.rpc(
          "learning_submit",
          submitArgs(assignment, 1, "Dopunjeno rješenje"),
        ),
      );
      await denied(
        db.student.rpc("learning_submit", submitArgs(assignment, 1)),
        "LEARNING_CONFLICT",
      );
      await denied(
        db.student2.rpc("learning_submit", submitArgs(assignment)),
        "LEARNING_FORBIDDEN",
      );
    },
  );
  await check(
    "student submissions are private to their owner and course staff, including peers on the same course",
    async () => {
      const membership = await ok(
        service
          .from("memberships")
          .select("user_id")
          .eq("institution_id", f.a)
          .eq("user_id", users.student2.id)
          .eq("role", "student"),
      );
      if (!membership.length) {
        await ok(
          service.from("memberships").insert({
            institution_id: f.a,
            user_id: users.student2.id,
            role: "student",
          }),
        );
        membershipAdded = true;
      }
      const sem = await ok(
        service
          .from("semesters")
          .select("academic_year_id")
          .eq("id", baseCourse.semester_id)
          .single(),
      );
      peerStudy = randomUUID();
      await ok(
        service.from("student_studies").insert({
          id: peerStudy,
          institution_id: f.a,
          student_id: users.student2.id,
          program_id: baseCourse.program_id,
          academic_year_id: sem.academic_year_id,
          study_year: 1,
          student_number: `LMS-${tag}`,
          status: "active",
          completion_status: "legacy_unverified",
        }),
      );
      await ok(
        service.from("course_enrollments").insert({
          institution_id: f.a,
          course_id: f.courseA,
          study_id: peerStudy,
          student_id: users.student2.id,
        }),
      );
      const peer = await ok(
        db.student2.rpc(
          "learning_submit",
          submitArgs(assignment, 0, "Privatni rad drugog studenta"),
        ),
      );
      assert.deepEqual(
        await ok(
          db.student.from("learning_submissions").select("*").eq("id", peer),
        ),
        [],
      );
      assert.deepEqual(
        await ok(
          db.student2
            .from("learning_submissions")
            .select("*")
            .eq("id", submission),
        ),
        [],
      );
      assert.equal(
        (
          await ok(
            db.nastavnik
              .from("learning_submissions")
              .select("*")
              .eq("assignment_id", assignment),
          )
        ).length,
        2,
      );
      await denied(
        db.student
          .from("learning_submissions")
          .update({ score: 20 })
          .eq("id", submission),
      );
    },
  );
  await check(
    "grading validates maximum points, locks graded answers and rejects stale grading",
    async () => {
      await denied(
        db.nastavnik.rpc("learning_grade", {
          target: submission,
          points: 21,
          note: "",
          expected: 2,
        }),
        "LEARNING_INVALID",
      );
      await denied(
        db.student.rpc("learning_grade", {
          target: submission,
          points: 20,
          note: "",
          expected: 2,
        }),
        "LEARNING_FORBIDDEN",
      );
      await ok(
        db.nastavnik.rpc("learning_grade", {
          target: submission,
          points: 18.5,
          note: "Dobro obrazloženo.",
          expected: 2,
        }),
      );
      await denied(
        db.nastavnik.rpc("learning_grade", {
          target: submission,
          points: 20,
          note: "Stara stranica",
          expected: 2,
        }),
        "LEARNING_CONFLICT",
      );
      await denied(
        db.student.rpc("learning_submit", submitArgs(assignment, 3)),
        "LEARNING_GRADED",
      );
      const row = await ok(
        db.student
          .from("learning_submissions")
          .select("*")
          .eq("id", submission)
          .single(),
      );
      assert.equal(row.score, 18.5);
      assert.equal(row.feedback, "Dobro obrazloženo.");
      await denied(
        db.nastavnik.rpc("learning_save_assignment", {
          ...assignmentArgs(),
          target: assignment,
          expected: 1,
          item_max: 50,
        }),
        "LEARNING_POINTS_LOCKED",
      );
    },
  );
  await check(
    "removing active course access hides content and submissions immediately",
    async () => {
      await ok(
        service
          .from("student_studies")
          .update({ status: "paused" })
          .eq("id", peerStudy),
      );
      assert.deepEqual(
        await ok(
          db.student2
            .from("learning_submissions")
            .select("*")
            .eq("assignment_id", assignment),
        ),
        [],
      );
      assert.ok(
        !(await ok(db.student2.rpc("learning_courses"))).some(
          (x) => x.id === f.courseA,
        ),
      );
      await denied(
        db.student2.rpc("learning_submit", submitArgs(assignment, 1)),
        "LEARNING_FORBIDDEN",
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
      "3012",
    ],
    {
      env: {
        ...process.env,
        BASE_DOMAIN: "isvu.me",
        VERCEL: "",
        NEXT_PUBLIC_SUPABASE_URL: c.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: c.ANON_KEY,
        SVS_SUPABASE_URL: c.API_URL,
        SVS_SUPABASE_SECRET_KEY: c.SERVICE_ROLE_KEY,
        MERLIN_LMS_URL: "",
        WEBMAIL_LOGIN_URL: "https://mail.example.test/login",
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
  assert.ok(ready, "local Next server ready");
  const teacherCookie = await login("nastavnik"),
    studentCookie = await login("student");
  await check(
    "HTTP workspace preserves selected course, escapes content and blocks foreign origins",
    async () => {
      const r = await request(
        `/?module=merlin&course=${f.courseA}&view=Predaje`,
        null,
        teacherCookie,
      );
      assert.equal(r.status, 200);
      const text = await r.text();
      assert.ok(text.includes('href="https://merlinhr.gnomio.com/my/"'));
      assert.ok(text.includes("Otvori Moodle"));
      assert.ok(text.includes("Dopunjeno rješenje"));
      assert.ok(text.includes("18.5/20"));
      const forged = await request(
        "/api/learning/grade",
        {
          submission_id: submission,
          score: "20",
          feedback: "",
          revision: "3",
          course_id: f.courseA,
        },
        teacherCookie,
        { origin: "https://foreign.test" },
      );
      assert.equal(forged.status, 403);
      const invalid = await request(
        "/api/learning/material",
        {
          course_id: f.courseA,
          id: "",
          revision: "0",
          title: "Loša poveznica",
          body: "Tekst",
          resource_url: "javascript:alert(1)",
          published: "on",
        },
        teacherCookie,
      );
      assert.equal(invalid.status, 303);
      assert.equal(
        new URL(invalid.headers.get("location")).searchParams.get("status"),
        "invalid",
      );
      const hidden = await request(
        `/?module=merlin&course=${courseExtra}`,
        null,
        studentCookie,
      );
      const hiddenText = await hidden.text();
      assert.ok(
        hidden.status === 404 ||
          (hidden.status === 200 &&
            hiddenText.includes("NEXT_HTTP_ERROR_FALLBACK;404")),
      );
      assert.ok(!hiddenText.includes(`Nepovezani kolegij ${tag}`));
      const materialPage = await request(
        `/?module=merlin&course=${f.courseA}&view=Materijali`,
        null,
        studentCookie,
      );
      const materialText = await materialPage.text();
      assert.ok(materialText.includes("&lt;b&gt;doslovni tekst&lt;/b&gt;"));
      assert.ok(!materialText.includes("<b>doslovni tekst</b>"));
      const mail = await request("/webmail", null, studentCookie);
      const mailText = await mail.text();
      assert.ok(mailText.includes('href="https://mail.example.test/login"'));
      assert.ok(!mailText.includes("WEBMAIL_LOGIN_URL"));
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE)
    await check(
      "Chromium teacher publishes an assignment, student submits and teacher returns feedback",
      async () => {
        const { chromium } = await import(
          process.env.WORKFLOW_PLAYWRIGHT_MODULE
        );
        const browser = await chromium.launch({
          executablePath: "/usr/bin/chromium",
          headless: true,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        });
        try {
          const page = await browser.newPage();
          const signIn = async (role) => {
            await page.context().clearCookies();
            await page.goto(origin + "/?module=auth&next=merlin");
            await page
              .getByLabel("E-adresa", { exact: true })
              .fill(users[role].email);
            await page
              .getByLabel("Lozinka", { exact: true })
              .fill(users[role].password);
            await page
              .getByRole("button", { name: "Prijavi se", exact: true })
              .click();
            await page.waitForURL(
              (u) => u.searchParams.get("module") === "merlin",
            );
          };
          await signIn("nastavnik");
          await page.goto(
            origin + `/?module=merlin&course=${f.courseA}&view=Zadaci`,
          );
          const add = page.locator("details").filter({
            has: page.locator("summary", { hasText: "Dodaj zadatak" }),
          });
          await add.locator("summary").click();
          const title = `Preglednički zadatak ${tag}`;
          await add.getByLabel("Naslov zadatka").fill(title);
          await add.getByLabel("Upute za izradu").fill("Objasnite rješenje.");
          await add.getByLabel("Objavljeno studentima").check();
          await add
            .getByRole("button", { name: "Spremi zadatak", exact: true })
            .click();
          await page.waitForURL(
            (u) => u.searchParams.get("status") === "saved",
          );
          const row = await ok(
            service
              .from("learning_assignments")
              .select("id")
              .eq("title", title)
              .single(),
          );
          assignments.push(row.id);
          await signIn("student");
          await page.goto(
            origin + `/?module=merlin&course=${f.courseA}&view=Zadaci`,
          );
          let card = page.locator("article").filter({
            has: page.getByRole("heading", { name: title, exact: true }),
          });
          await card
            .getByLabel("Odgovor / tekst rada")
            .fill("Predaja iz stvarnog preglednika.");
          await card
            .getByRole("button", { name: "Predaj rad", exact: true })
            .click();
          await page.waitForURL(
            (u) => u.searchParams.get("status") === "saved",
          );
          await signIn("nastavnik");
          await page.goto(
            origin + `/?module=merlin&course=${f.courseA}&view=Predaje`,
          );
          card = page.locator("article").filter({
            has: page.getByRole("heading", { name: title, exact: true }),
          });
          await card.locator("details > summary").click();
          await card.getByLabel("Bodovi (0–100)", { exact: true }).fill("90");
          await card
            .getByLabel("Povratna informacija studentu")
            .fill("Pregledano u pregledniku.");
          await card
            .getByRole("button", {
              name: "Spremi bodove i povratnu informaciju",
            })
            .click();
          await page.waitForURL(
            (u) => u.searchParams.get("status") === "saved",
          );
          await signIn("student");
          await page.goto(
            origin + `/?module=merlin&course=${f.courseA}&view=Zadaci`,
          );
          card = page.locator("article").filter({
            has: page.getByRole("heading", { name: title, exact: true }),
          });
          assert.ok(
            (await card.innerText()).includes("Pregledano u pregledniku."),
          );
          assert.equal(
            await card
              .getByRole("button", { name: "Zamijeni predaju" })
              .count(),
            0,
          );
          await page.setViewportSize({ width: 390, height: 844 });
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
        } finally {
          await browser.close();
        }
      },
    );
  console.log(`${count} native learning scenarios passed.`);
} finally {
  if (server) server.kill("SIGTERM");
  if (assignments.length) {
    await ok(
      service
        .from("learning_submissions")
        .delete()
        .in("assignment_id", assignments),
    );
    await ok(
      service.from("learning_assignments").delete().in("id", assignments),
    );
  }
  if (materials.length)
    await ok(service.from("learning_materials").delete().in("id", materials));
  if (peerStudy) {
    await ok(
      service.from("course_enrollments").delete().eq("study_id", peerStudy),
    );
    await ok(service.from("student_studies").delete().eq("id", peerStudy));
  }
  if (membershipAdded)
    await ok(
      service
        .from("memberships")
        .delete()
        .eq("institution_id", f.a)
        .eq("user_id", users.student2.id)
        .eq("role", "student"),
    );
  if (courseExtra)
    await ok(service.from("courses").delete().eq("id", courseExtra));
}
