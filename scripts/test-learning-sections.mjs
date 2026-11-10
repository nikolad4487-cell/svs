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
  sectionIds = [],
  materialIds = [],
  assignmentIds = [],
  quizIds = [],
  fileIds = [],
  paths = [];
const origin = "http://localhost:3015";
let server,
  browser,
  count = 0;
const check = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};
const request = (path, body, cookie = "", extra = {}) =>
  fetch(origin + path, {
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
const sectionArgs = (extra = {}) => ({
  target_course: f.courseA,
  item_title: `Cjelina ${tag}`,
  item_summary: "Uvod u temu",
  item_published: true,
  ...extra,
});
const item = (extra = {}) => ({
  item_title: `Stranica ${tag}`,
  item_body: "Uvodni tekst",
  item_url: "",
  item_published: true,
  target: null,
  expected: 0,
  ...extra,
});
const save = (kind, content, section, extra = {}) =>
  teacher.rpc("learning_save_content", {
    target_course: f.courseA,
    kind,
    item: content,
    target_section: section,
    ...extra,
  });
const row = (table, id) =>
  ok(teacher.from(table).select("*").eq("id", id).single());
const invisible = async (table, id) =>
  assert.deepEqual(await ok(student.from(table).select("*").eq("id", id)), []);
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
  let visible, hidden, material, assignment, quiz, attachment;
  await check(
    "only assigned staff manage sections and versions reject stale writes",
    async () => {
      await denied(
        student.rpc("learning_save_section", sectionArgs()),
        "LEARNING_FORBIDDEN",
      );
      await denied(
        teacher.rpc(
          "learning_save_section",
          sectionArgs({ target_course: f.courseB }),
        ),
        "LEARNING_FORBIDDEN",
      );
      visible = await ok(teacher.rpc("learning_save_section", sectionArgs()));
      sectionIds.push(visible);
      hidden = await ok(
        teacher.rpc(
          "learning_save_section",
          sectionArgs({ item_title: `Skrivena ${tag}`, item_published: false }),
        ),
      );
      sectionIds.push(hidden);
      await invisible("learning_sections", hidden);
      await denied(
        teacher.rpc(
          "learning_save_section",
          sectionArgs({ target: visible, expected: 0 }),
        ),
        "LEARNING_CONFLICT",
      );
      await denied(
        student.rpc("learning_order_section", {
          target_course: f.courseA,
          target: visible,
          expected: 1,
          direction: "delete",
        }),
        "LEARNING_FORBIDDEN",
      );
    },
  );
  await check(
    "activity placement is atomic, scoped to its course, and rich content is bounded",
    async () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Uvodni tekst", marks: [{ type: "bold" }] },
            ],
          },
        ],
      };
      material = await ok(
        save("material", item(), visible, {
          item_resource: "page",
          document: doc,
        }),
      );
      materialIds.push(material);
      assert.equal(
        (await row("learning_materials", material)).rich_body.content[0]
          .content[0].marks[0].type,
        "bold",
      );
      await denied(
        save(
          "material",
          item({
            target: material,
            expected: 1,
            item_title: "Ne smije se promijeniti",
          }),
          randomUUID(),
        ),
        "LEARNING_FORBIDDEN",
      );
      assert.equal((await row("learning_materials", material)).revision, 1);
      await denied(
        teacher.rpc("learning_save_content", {
          target_course: f.courseB,
          kind: "material",
          item: item(),
          target_section: visible,
        }),
        "LEARNING_FORBIDDEN",
      );
      await denied(
        save("material", item(), visible, {
          document: {
            type: "doc",
            content: [
              {
                type: "text",
                text: "Opasna veza",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        }),
        "LEARNING_INVALID",
      );
      assert.equal(
        (
          await ok(
            student.from("learning_materials").select("id").eq("id", material),
          )
        ).length,
        1,
      );
      assert.deepEqual(
        await ok(
          peer.from("learning_materials").select("id").eq("id", material),
        ),
        [],
      );
    },
  );
  await check(
    "hidden sections protect resources, quiz questions, file storage and legacy submission RPCs",
    async () => {
      assignment = await ok(
        save(
          "assignment",
          {
            ...item(),
            item_instructions: "Predajte odgovor.",
            item_due: null,
            item_max: 10,
            item_late: false,
          },
          hidden,
        ),
      );
      assignmentIds.push(assignment);
      quiz = await ok(
        save(
          "quiz",
          {
            ...item(),
            item_description: "Odaberite odgovor.",
            item_opens: null,
            item_closes: null,
            questions: [
              {
                prompt: "Dva plus dva?",
                choices: ["4", "5"],
                correct_index: 0,
                points: 1,
              },
            ],
          },
          hidden,
        ),
      );
      quizIds.push(quiz);
      await invisible("learning_assignments", assignment);
      await invisible("learning_quizzes", quiz);
      assert.deepEqual(
        await ok(
          student
            .from("learning_quiz_questions")
            .select("*")
            .eq("quiz_id", quiz),
        ),
        [],
      );
      await denied(
        student.rpc("learning_submit", {
          target: assignment,
          answer: "Odgovor",
          answer_url: "",
          expected: 0,
        }),
        "LEARNING_FORBIDDEN",
      );
      await denied(
        student.rpc("learning_submit_quiz", {
          target: quiz,
          expected: 1,
          responses: {},
        }),
        "LEARNING_FORBIDDEN",
      );
      await ok(
        save("material", item({ target: material, expected: 1 }), hidden),
      );
      attachment = await ok(
        teacher.rpc("learning_reserve_file", {
          kind: "material",
          target: material,
          filename: `skrivena-${tag}.txt`,
          mimetype: "text/plain",
          bytes: 4,
        }),
      );
      fileIds.push(attachment.id);
      paths.push(attachment.object_path);
      await ok(
        teacher.storage
          .from("merlin-files")
          .upload(attachment.object_path, Buffer.from("test"), {
            contentType: "text/plain",
            upsert: false,
          }),
      );
      await ok(
        teacher.rpc("learning_complete_file", { target: attachment.id }),
      );
      await invisible("learning_materials", material);
      await invisible("learning_files", attachment.id);
      await denied(
        student.storage
          .from("merlin-files")
          .createSignedUrl(attachment.object_path, 60),
      );
      await ok(
        save("material", item({ target: material, expected: 2 }), visible),
      );
      assert.equal(
        (
          await ok(
            student.from("learning_files").select("id").eq("id", attachment.id),
          )
        ).length,
        1,
      );
    },
  );
  await check(
    "mixed activities can move between sections and reorder; nonempty deletion is rejected",
    async () => {
      const a = await row("learning_assignments", assignment);
      await ok(
        save(
          "assignment",
          {
            ...item({ target: assignment, expected: a.revision }),
            item_instructions: a.instructions,
            item_due: null,
            item_max: 10,
            item_late: false,
          },
          visible,
        ),
      );
      const before = await row("learning_assignments", assignment);
      await ok(
        teacher.rpc("learning_order_activity", {
          target_course: f.courseA,
          target: assignment,
          kind: "assignment",
          expected: before.revision,
          direction: "up",
        }),
      );
      assert.ok(
        (await row("learning_assignments", assignment)).sort_order <
          (await row("learning_materials", material)).sort_order,
      );
      await denied(
        teacher.rpc("learning_order_activity", {
          target_course: f.courseA,
          target: assignment,
          kind: "assignment",
          expected: before.revision,
          direction: "down",
        }),
        "LEARNING_CONFLICT",
      );
      await denied(
        teacher.rpc("learning_order_section", {
          target_course: f.courseA,
          target: visible,
          expected: 1,
          direction: "delete",
        }),
        "LEARNING_SECTION_NOT_EMPTY",
      );
      await ok(
        teacher.rpc("learning_order_section", {
          target_course: f.courseA,
          target: hidden,
          expected: 1,
          direction: "up",
        }),
      );
      assert.ok(
        (await row("learning_sections", hidden)).sort_order <
          (await row("learning_sections", visible)).sort_order,
      );
    },
  );
  await check(
    "file resources require a completed upload and legacy plain edits clear stale formatting",
    async () => {
      await denied(
        save("material", item(), null, { item_resource: "file" }),
        "LEARNING_FILE_REQUIRED",
      );
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Stari tekst", marks: [{ type: "bold" }] },
            ],
          },
        ],
      };
      const legacy = await ok(
        save("material", item({ item_body: "Stari tekst" }), null, {
          document: doc,
        }),
      );
      materialIds.push(legacy);
      await ok(
        teacher.rpc("learning_save_material", {
          target_course: f.courseA,
          item_title: "Promijenjen tekst",
          item_body: "Novi tekst",
          item_url: "",
          item_published: true,
          target: legacy,
          expected: 1,
        }),
      );
      const changed = await row("learning_materials", legacy);
      assert.equal(changed.rich_body, null);
      assert.equal(changed.body, "Novi tekst");
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
      "3015",
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
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE)
    await check(
      "Chromium creates sections and formatted resources through chooser; student has no edit controls and mobile layouts fit",
      async () => {
        const { chromium } = await import(
          process.env.WORKFLOW_PLAYWRIGHT_MODULE
        );
        browser = await chromium.launch({
          executablePath: "/usr/bin/chromium",
          headless: true,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        });
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        });
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
        await page.goto(origin + `/?module=merlin&course=${f.courseA}`);
        assert.equal(
          await page
            .getByRole("button", {
              name: "Dodaj aktivnost ili resurs",
              exact: true,
            })
            .count(),
          0,
        );
        await page.getByRole("switch", { name: "Način uređivanja" }).click();
        await page.getByText("Dodaj cjelinu", { exact: true }).click();
        const sectionForm = page
          .locator('form[action="/api/learning/section"]')
          .last();
        const sectionTitle = `Preglednička cjelina ${tag}`;
        await sectionForm.getByLabel("Naziv cjeline").fill(sectionTitle);
        await sectionForm.getByLabel("Opis cjeline").fill("Opis za studente.");
        await sectionForm
          .getByRole("button", { name: "Spremi cjelinu", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        const createdSection = await ok(
          service
            .from("learning_sections")
            .select("id")
            .eq("title", sectionTitle)
            .single(),
        );
        sectionIds.push(createdSection.id);
        const sectionCard = page.locator(`[id="section-${createdSection.id}"]`);
        await sectionCard
          .getByRole("button", {
            name: "Dodaj aktivnost ili resurs",
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Pretraži aktivnosti").fill("Stranica");
        await dialog.getByRole("link", { name: /Stranica/ }).click();
        await page.waitForURL((u) => u.searchParams.get("create") === "page");
        const form = page
          .locator('form[action="/api/learning/material"]')
          .first();
        const title = `Oblikovana stranica ${tag}`;
        await form.getByLabel("Naslov materijala").fill(title);
        assert.equal(
          await form.getByLabel("Cjelina kolegija").inputValue(),
          createdSection.id,
        );
        await form
          .getByRole("button", { name: "Podebljano", exact: true })
          .click();
        await form
          .getByRole("textbox", { name: "Tekst materijala", exact: true })
          .fill("Važno gradivo za učenje.");
        await form.getByLabel("Objavljeno studentima").check();
        await form
          .getByRole("button", { name: "Spremi materijal", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        const resource = await ok(
          service
            .from("learning_materials")
            .select("*")
            .eq("title", title)
            .single(),
        );
        materialIds.push(resource.id);
        assert.equal(resource.resource_kind, "page");
        assert.equal(resource.section_id, createdSection.id);
        assert.ok(resource.rich_body);
        assert.ok(
          resource.rich_body.content[0].content[0].marks?.some(
            (m) => m.type === "bold",
          ),
        );
        await page.goto(origin + `/?module=merlin&course=${f.courseA}&edit=1`);
        await page.getByRole("heading", { level: 1 }).waitFor();
        await page.screenshot({
          path: "/tmp/isvu-merlin-sections-edit.png",
          fullPage: true,
        });
        await sectionCard
          .getByRole("button", {
            name: "Dodaj aktivnost ili resurs",
            exact: true,
          })
          .click();
        await dialog.waitFor();
        await page.screenshot({
          path: "/tmp/isvu-merlin-activity-chooser.png",
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await login("student");
        await page.goto(origin + `/?module=merlin&course=${f.courseA}&edit=1`);
        assert.equal(
          await page.getByRole("switch", { name: "Način uređivanja" }).count(),
          0,
        );
        assert.equal(
          await page
            .getByRole("button", {
              name: "Dodaj aktivnost ili resurs",
              exact: true,
            })
            .count(),
          0,
        );
        assert.equal(
          await page.getByText(`Skrivena ${tag}`, { exact: false }).count(),
          0,
        );
        await page
          .getByRole("link", { name: title, exact: true })
          .last()
          .click();
        await page
          .locator(`article[id="${resource.id}"]`)
          .getByText("Važno gradivo za učenje.", { exact: true })
          .waitFor();
        await page.goto(origin + `/?module=merlin&course=${f.courseA}`);
        await page
          .getByRole("navigation", { name: "Cjeline kolegija", exact: true })
          .waitFor();
        await page.screenshot({
          path: "/tmp/isvu-merlin-sections-student.png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.goto(origin + "/?module=merlin");
        await page.getByLabel("Prikaz kolegija").selectOption("list");
        await page.getByLabel("Poredak kolegija").selectOption("year");
        await page
          .getByRole("heading", { name: "Vremenska crta", exact: true })
          .waitFor();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
      },
    );
  console.log(`${count} course-structure scenarios passed.`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill("SIGTERM");
  if (paths.length)
    await ok(service.storage.from("merlin-files").remove(paths));
  if (fileIds.length)
    await ok(service.from("learning_files").delete().in("id", fileIds));
  if (assignmentIds.length) {
    await ok(
      service
        .from("learning_submissions")
        .delete()
        .in("assignment_id", assignmentIds),
    );
    await ok(
      service.from("learning_assignments").delete().in("id", assignmentIds),
    );
  }
  if (quizIds.length) {
    await ok(
      service.from("learning_quiz_attempts").delete().in("quiz_id", quizIds),
    );
    await ok(
      service.from("learning_quiz_questions").delete().in("quiz_id", quizIds),
    );
    await ok(service.from("learning_quizzes").delete().in("id", quizIds));
  }
  if (materialIds.length)
    await ok(service.from("learning_materials").delete().in("id", materialIds));
  if (sectionIds.length)
    await ok(service.from("learning_sections").delete().in("id", sectionIds));
}
