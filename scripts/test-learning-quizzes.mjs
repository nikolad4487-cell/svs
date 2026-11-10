import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(c.API_URL).hostname));
const users = JSON.parse(readFileSync(".local-test-users.json")),
  f = JSON.parse(readFileSync(".local-academic.json"));
const client = (key = c.ANON_KEY) =>
  createClient(c.API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = client(c.SERVICE_ROLE_KEY),
  teacher = client(),
  student = client(),
  peer = client();
const ok = async (promise) => {
  const r = await promise;
  assert.ifError(r.error);
  return r.data;
};
const denied = async (promise, code) => {
  const r = await promise;
  assert.ok(r.error);
  if (code) assert.ok(r.error.message.includes(code), r.error.message);
};
const tag = randomUUID().slice(0, 8),
  quizzes = [];
let count = 0,
  server,
  browser,
  peerStudy,
  membershipAdded = false;
const check = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};
const questionSet = [
  {
    prompt: "Koliko je dva i dva?",
    choices: ["Četiri", "Pet"],
    correct_index: 0,
    points: 2,
  },
  {
    prompt: "Koji grad je glavni grad Hrvatske?",
    choices: ["Split", "Zagreb"],
    correct_index: 1,
    points: 3,
  },
];
const args = (extra = {}) => ({
  target_course: f.courseA,
  item_title: `Kviz ${tag}`,
  item_description: "Odaberite jedan odgovor za svako pitanje.",
  item_opens: null,
  item_closes: null,
  item_published: true,
  questions: questionSet,
  ...extra,
});
const create = async (extra) => {
  const id = await ok(teacher.rpc("learning_save_quiz", args(extra)));
  quizzes.push(id);
  return id;
};
const questions = async (id) =>
  ok(
    teacher
      .from("learning_quiz_questions")
      .select("*")
      .eq("quiz_id", id)
      .order("position"),
  );
const origin = "http://localhost:3014";
async function request(path, body, cookie = "", extra = {}) {
  return fetch(origin + path, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      cookie,
      ...(body
        ? { origin, "content-type": "application/x-www-form-urlencoded" }
        : {}),
      ...extra,
    },
    ...(body ? { body: new URLSearchParams(body) } : {}),
  });
}
async function cookie(role) {
  const r = await request("/api/auth/login", {
    email: users[role].email,
    password: users[role].password,
    next: "merlin",
  });
  assert.equal(r.status, 303);
  return r.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
}
try {
  for (const [db, role] of [
    [teacher, "nastavnik"],
    [student, "student"],
    [peer, "student2"],
  ])
    await ok(
      db.auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      }),
    );
  let quiz, draft, qs;
  await check(
    "only assigned course staff create quizzes and drafts hide their questions",
    async () => {
      await denied(
        student.rpc("learning_save_quiz", args()),
        "LEARNING_FORBIDDEN",
      );
      await denied(
        teacher.rpc("learning_save_quiz", args({ target_course: f.courseB })),
        "LEARNING_FORBIDDEN",
      );
      draft = await create({ item_published: false });
      assert.deepEqual(
        await ok(student.from("learning_quizzes").select("*").eq("id", draft)),
        [],
      );
      assert.deepEqual(
        await ok(
          student
            .from("learning_quiz_questions")
            .select("*")
            .eq("quiz_id", draft),
        ),
        [],
      );
      quiz = await create();
      qs = await questions(quiz);
      assert.equal(qs.length, 2);
    },
  );
  await check(
    "student reads published prompts and choices but never answer keys",
    async () => {
      assert.equal(
        (
          await ok(
            student
              .from("learning_quiz_questions")
              .select("*")
              .eq("quiz_id", quiz),
          )
        ).length,
        2,
      );
      assert.deepEqual(
        await ok(
          student
            .from("learning_quiz_keys")
            .select("*")
            .in(
              "question_id",
              qs.map((q) => q.id),
            ),
        ),
        [],
      );
      assert.deepEqual(
        await ok(
          peer.from("learning_quiz_questions").select("*").eq("quiz_id", quiz),
        ),
        [],
      );
      await denied(
        student.from("learning_quiz_attempts").insert({
          institution_id: f.a,
          course_id: f.courseA,
          quiz_id: quiz,
          student_id: users.student.id,
          answers: {},
          score: 5,
          max_points: 5,
        }),
      );
    },
  );
  await check(
    "server rejects unknown question ids, out-of-range options, drafts and closed windows",
    async () => {
      for (const responses of [
        { [randomUUID()]: 0 },
        { [qs[0].id]: 2 },
        { [qs[0].id]: "0" },
      ])
        await denied(
          student.rpc("learning_submit_quiz", {
            target: quiz,
            expected: 1,
            responses,
          }),
          "LEARNING_INVALID",
        );
      await denied(
        student.rpc("learning_submit_quiz", {
          target: draft,
          expected: 1,
          responses: {},
        }),
        "LEARNING_FORBIDDEN",
      );
      for (const extra of [
        { item_opens: new Date(Date.now() + 86400000).toISOString() },
        { item_closes: new Date(Date.now() - 86400000).toISOString() },
      ]) {
        const closed = await create(extra);
        assert.deepEqual(
          await ok(
            student
              .from("learning_quiz_questions")
              .select("id")
              .eq("quiz_id", closed),
          ),
          [],
        );
        await denied(
          student.rpc("learning_submit_quiz", {
            target: closed,
            expected: 1,
            responses: {},
          }),
          "LEARNING_QUIZ_CLOSED",
        );
      }
    },
  );
  let attempt;
  await check(
    "concurrent submissions create one attempt and calculate weighted scores from private keys",
    async () => {
      const responses = { [qs[0].id]: 0, [qs[1].id]: 0 };
      const results = await Promise.all([
        student.rpc("learning_submit_quiz", {
          target: quiz,
          expected: 1,
          responses,
        }),
        student.rpc("learning_submit_quiz", {
          target: quiz,
          expected: 1,
          responses,
        }),
      ]);
      assert.equal(results.filter((r) => !r.error).length, 1);
      assert.ok(
        results
          .find((r) => r.error)
          .error.message.includes("LEARNING_QUIZ_DONE"),
      );
      attempt = results.find((r) => !r.error).data;
      const row = await ok(
        student
          .from("learning_quiz_attempts")
          .select("*")
          .eq("id", attempt)
          .single(),
      );
      assert.equal(row.score, 2);
      assert.equal(row.max_points, 5);
      await denied(
        student
          .from("learning_quiz_attempts")
          .update({ score: 5 })
          .eq("id", attempt),
      );
    },
  );
  await check(
    "answered questions are immutable while metadata can change with a current revision",
    async () => {
      await denied(
        teacher.rpc(
          "learning_save_quiz",
          args({
            target: quiz,
            expected: 1,
            questions: [
              { ...questionSet[0], correct_index: 1 },
              questionSet[1],
            ],
          }),
        ),
        "LEARNING_QUIZ_LOCKED",
      );
      await ok(
        teacher.rpc(
          "learning_save_quiz",
          args({
            target: quiz,
            expected: 1,
            item_title: `Promijenjen naziv ${tag}`,
          }),
        ),
      );
      await denied(
        teacher.rpc("learning_save_quiz", args({ target: quiz, expected: 1 })),
        "LEARNING_CONFLICT",
      );
      assert.deepEqual(
        (await questions(quiz)).map((q) => q.id),
        qs.map((q) => q.id),
      );
    },
  );
  await check(
    "attempts stay private between peers enrolled in the same course",
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
      const course = await ok(
        service
          .from("courses")
          .select("program_id,semester_id")
          .eq("id", f.courseA)
          .single(),
      );
      const sem = await ok(
        service
          .from("semesters")
          .select("academic_year_id")
          .eq("id", course.semester_id)
          .single(),
      );
      peerStudy = randomUUID();
      await ok(
        service.from("student_studies").insert({
          id: peerStudy,
          institution_id: f.a,
          student_id: users.student2.id,
          program_id: course.program_id,
          academic_year_id: sem.academic_year_id,
          study_year: 1,
          student_number: `QUIZ-${tag}`,
          status: "active",
          completion_status: "legacy_unverified",
        }),
      );
      await ok(
        service.from("course_enrollments").insert({
          institution_id: f.a,
          course_id: f.courseA,
          student_id: users.student2.id,
          study_id: peerStudy,
        }),
      );
      const peerAttempt = await ok(
        peer.rpc("learning_submit_quiz", {
          target: quiz,
          expected: 2,
          responses: { [qs[0].id]: 0, [qs[1].id]: 1 },
        }),
      );
      assert.deepEqual(
        await ok(
          student
            .from("learning_quiz_attempts")
            .select("*")
            .eq("id", peerAttempt),
        ),
        [],
      );
      assert.deepEqual(
        await ok(
          peer.from("learning_quiz_attempts").select("*").eq("id", attempt),
        ),
        [],
      );
      assert.equal(
        (
          await ok(
            teacher
              .from("learning_quiz_attempts")
              .select("*")
              .eq("quiz_id", quiz),
          )
        ).length,
        2,
      );
      await ok(
        service
          .from("student_studies")
          .update({ status: "paused" })
          .eq("id", peerStudy),
      );
      assert.deepEqual(
        await ok(
          peer.from("learning_quiz_attempts").select("*").eq("id", peerAttempt),
        ),
        [],
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
      "3014",
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
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await request("/")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready);
  const studentCookie = await cookie("student"),
    teacherCookie = await cookie("nastavnik");
  await check(
    "student HTML contains a result without author controls or private keys; HTTP mutations check origin",
    async () => {
      const response = await request(
        `/?module=merlin&course=${f.courseA}&view=Kvizovi`,
        null,
        studentCookie,
      );
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes("Vaš rezultat:"));
      assert.ok(!html.includes("correct_index"));
      assert.ok(!html.includes("Točan odgovor"));
      assert.ok(!html.includes("Dodaj kviz"));
      const result = await request(
        "/api/learning/quiz-submit",
        { quiz_id: quiz, revision: "2", answers: "{}", course_id: f.courseA },
        studentCookie,
        { origin: "https://foreign.test" },
      );
      assert.equal(result.status, 403);
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE)
    await check(
      "Chromium teacher builds a quiz, student submits, and catalogue search/favourites and mobile layouts work",
      async () => {
        const { chromium } = await import(
          process.env.WORKFLOW_PLAYWRIGHT_MODULE
        );
        browser = await chromium.launch({
          executablePath: "/usr/bin/chromium",
          headless: true,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        });
        const page = await browser.newPage();
        const login = async (role) => {
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
        await login("nastavnik");
        await page.goto(
          origin + `/?module=merlin&course=${f.courseA}&view=Kvizovi`,
        );
        const add = page
          .locator("details")
          .filter({ has: page.locator("summary", { hasText: "Dodaj kviz" }) });
        await add.locator("summary").click();
        const title = `Preglednički kviz ${tag}`;
        await add.getByLabel("Naziv kviza").fill(title);
        await add.getByLabel("Upute za kviz").fill("Odaberite jedan odgovor.");
        await add.getByLabel("Tekst pitanja 1").fill("Koliko je dva i dva?");
        const first = add.locator("fieldset").first();
        await first.getByLabel("Odgovor A", { exact: true }).fill("Četiri");
        await first.getByLabel("Odgovor B", { exact: true }).fill("Pet");
        await first.getByLabel("Bodovi pitanja 1").fill("2");
        await add
          .getByRole("button", { name: "Dodaj pitanje", exact: true })
          .click();
        await add
          .getByLabel("Tekst pitanja 2")
          .fill("Koji grad je glavni grad Hrvatske?");
        const second = add.locator("fieldset").nth(1);
        await second.getByLabel("Odgovor A", { exact: true }).fill("Split");
        await second.getByLabel("Odgovor B", { exact: true }).fill("Zagreb");
        await second.getByLabel("Točan odgovor 2").selectOption("1");
        await second.getByLabel("Bodovi pitanja 2").fill("3");
        await add.getByLabel("Objavljeno studentima").check();
        await add
          .getByRole("button", { name: "Spremi kviz", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        const created = await ok(
          service
            .from("learning_quizzes")
            .select("id")
            .eq("title", title)
            .single(),
        );
        quizzes.push(created.id);
        await login("student");
        await page.goto(
          origin + `/?module=merlin&course=${f.courseA}&view=Kvizovi`,
        );
        const card = page.locator("article").filter({
          has: page.getByRole("heading", { name: title, exact: true }),
        });
        await card.getByText("Riješi kviz", { exact: true }).click();
        await card.getByLabel("A.Četiri", { exact: false }).check();
        await card.getByLabel("A.Split", { exact: false }).check();
        page.once("dialog", (d) => d.accept());
        await card
          .getByRole("button", { name: "Predaj kviz", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        await card
          .getByText("Vaš rezultat: 2/5 bodova", { exact: true })
          .waitFor();
        await page.goto(origin + "/?module=merlin");
        const search = page.getByLabel("Pretraži kolegije");
        await search.fill("nepostojeci-kolegij");
        await page
          .getByText("Nema kolegija za ovaj prikaz", { exact: true })
          .waitFor();
        await search.fill("");
        const course = await ok(
          service.from("courses").select("name").eq("id", f.courseA).single(),
        );
        await page
          .getByRole("button", {
            name: `Dodaj u omiljene: ${course.name}`,
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Omiljeni", exact: true })
          .click();
        await page
          .getByRole("link", {
            name: `Otvori kolegij: ${course.name}`,
            exact: true,
          })
          .waitFor();
        await page.reload();
        await page
          .getByRole("button", {
            name: `Ukloni iz omiljenih: ${course.name}`,
            exact: true,
          })
          .waitFor();
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({
          path: "/tmp/isvu-merlin-dashboard.png",
          fullPage: true,
        });
        await page.goto(origin + `/?module=merlin&course=${f.courseA}`);
        await page
          .getByRole("heading", { name: course.name, exact: true })
          .waitFor();
        await page.screenshot({
          path: "/tmp/isvu-merlin-course.png",
          fullPage: true,
        });
        await page.goto(
          origin + `/?module=merlin&course=${f.courseA}&view=Kvizovi`,
        );
        await page
          .getByRole("heading", { name: "Kvizovi", exact: true })
          .waitFor();
        await page.screenshot({
          path: "/tmp/isvu-merlin-quizzes.png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(origin + "/?module=merlin");
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.getByText("Izbornik e-učenja", { exact: true }).click();
        await page
          .getByRole("navigation", {
            name: "Mobilna Merlin navigacija",
            exact: true,
          })
          .getByRole("link", { name: "Moji kolegiji", exact: true })
          .waitFor();
      },
    );
  console.log(`${count} quiz and learning-interface scenarios passed.`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill("SIGTERM");
  if (quizzes.length) {
    await ok(
      service.from("learning_quiz_attempts").delete().in("quiz_id", quizzes),
    );
    await ok(
      service.from("learning_quiz_questions").delete().in("quiz_id", quizzes),
    );
    await ok(service.from("learning_quizzes").delete().in("id", quizzes));
  }
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
}
