import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
  outsider = client();
const ok = async (promise) => {
  const result = await promise;
  assert.ifError(result.error);
  return result.data;
};
const tag = randomUUID().slice(0, 8),
  materials = [],
  assignments = [],
  reserved = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC",
  "base64",
);
let count = 0,
  server,
  browser;
const check = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};
const origin = "http://localhost:3013";
async function request(path, body, cookie = "", extra = {}) {
  return fetch(origin + path, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      cookie,
      ...(body ? { origin, "content-type": "application/json" } : {}),
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login(role) {
  const response = await fetch(origin + "/api/auth/login", {
    method: "POST",
    redirect: "manual",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: users[role].email,
      password: users[role].password,
      next: "merlin",
    }),
  });
  assert.equal(response.status, 303);
  return response.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
}
async function reserve(
  kind,
  target,
  name = "slika.png",
  type = "image/png",
  size = png.length,
) {
  const file = await ok(
    teacher
      .rpc("learning_reserve_file", {
        kind,
        target,
        filename: name,
        mimetype: type,
        bytes: size,
      })
      .single(),
  );
  reserved.push(file);
  return file;
}
async function upload(file, content = png) {
  const signed = await ok(
    teacher.storage
      .from("merlin-files")
      .createSignedUploadUrl(file.object_path),
  );
  const response = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: { "content-type": file.mime_type },
    body: content,
  });
  assert.ok(response.ok, `signed upload returns ${response.status}`);
}
try {
  for (const [db, role] of [
    [teacher, "nastavnik"],
    [student, "student"],
    [outsider, "student2"],
  ])
    await ok(
      db.auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      }),
    );
  const createMaterial = async (published) => {
    const id = await ok(
      teacher.rpc("learning_save_material", {
        target_course: f.courseA,
        item_title: `Privitci ${tag}`,
        item_body: "Sadržaj s privitcima.",
        item_url: "",
        item_published: published,
      }),
    );
    materials.push(id);
    return id;
  };
  const published = await createMaterial(true),
    draft = await createMaterial(false);
  const assignment = await ok(
    teacher.rpc("learning_save_assignment", {
      target_course: f.courseA,
      item_title: `Datoteke zadatka ${tag}`,
      item_instructions: "Pogledajte priložene upute.",
      item_due: null,
      item_max: 100,
      item_published: true,
      item_late: false,
    }),
  );
  assignments.push(assignment);
  let visibleFile, draftFile;
  await check(
    "private Storage accepts a reserved staff upload and students cannot author attachments",
    async () => {
      assert.ok(
        (
          await student.rpc("learning_reserve_file", {
            kind: "material",
            target: published,
            filename: "slika.png",
            mimetype: "image/png",
            bytes: png.length,
          })
        ).error,
      );
      assert.ok(
        (
          await teacher.storage
            .from("merlin-files")
            .createSignedUploadUrl(`${f.courseA}/unreserved/file`)
        ).error,
      );
      visibleFile = await reserve("material", published);
      await upload(visibleFile);
      assert.equal(
        (
          await ok(
            student
              .from("learning_files")
              .select("id")
              .eq("id", visibleFile.id),
          )
        ).length,
        0,
      );
      assert.ok(
        (
          await student.storage
            .from("merlin-files")
            .download(visibleFile.object_path)
        ).error,
      );
      await ok(
        teacher.rpc("learning_complete_file", { target: visibleFile.id }),
      );
      const blob = await ok(
        student.storage.from("merlin-files").download(visibleFile.object_path),
      );
      assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png);
    },
  );
  await check(
    "draft, institution and anonymous access rules also protect Storage paths",
    async () => {
      draftFile = await reserve("material", draft);
      await upload(draftFile);
      await ok(teacher.rpc("learning_complete_file", { target: draftFile.id }));
      for (const [db, path] of [
        [student, draftFile.object_path],
        [outsider, visibleFile.object_path],
        [client(), visibleFile.object_path],
      ])
        assert.ok((await db.storage.from("merlin-files").download(path)).error);
      const publicRead = await fetch(
        `${c.API_URL}/storage/v1/object/public/merlin-files/${visibleFile.object_path}`,
      );
      assert.ok(!publicRead.ok);
      assert.ok(
        (
          await student.storage
            .from("merlin-files")
            .remove([visibleFile.object_path])
        ).error ||
          (
            await ok(
              teacher.storage
                .from("merlin-files")
                .download(visibleFile.object_path),
            )
          ).size === png.length,
      );
    },
  );
  await check(
    "completion rejects mismatched size and assignment attachments use the same private bucket",
    async () => {
      const wrong = await reserve(
        "material",
        published,
        "wrong.png",
        "image/png",
        png.length + 1,
      );
      await upload(wrong);
      assert.ok(
        (await teacher.rpc("learning_complete_file", { target: wrong.id }))
          .error,
      );
      const text = Buffer.from("Upute za zadatak.");
      const file = await reserve(
        "assignment",
        assignment,
        "upute.txt",
        "text/plain",
        text.length,
      );
      await upload(file, text);
      await ok(teacher.rpc("learning_complete_file", { target: file.id }));
      assert.equal(
        (
          await ok(
            student.storage.from("merlin-files").download(file.object_path),
          )
        ).size,
        text.length,
      );
      assert.ok(
        (
          await teacher.rpc("learning_reserve_file", {
            kind: "material",
            target: published,
            filename: "large.mp4",
            mimetype: "video/mp4",
            bytes: 52428801,
          })
        ).error,
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
      "3013",
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
  const cookie = await login("nastavnik"),
    studentCookie = await login("student");
  await check(
    "HTTP access, file validation and forced document downloads are checked with the user's session",
    async () => {
      const read = await request(
        `/api/learning/files/${visibleFile.id}?inline=1`,
        null,
        studentCookie,
      );
      assert.equal(read.status, 302);
      assert.ok(read.headers.get("cache-control").includes("no-store"));
      const download = await request(
        `/api/learning/files/${visibleFile.id}`,
        null,
        studentCookie,
      );
      assert.equal(
        new URL(download.headers.get("location")).searchParams.get("download"),
        "slika.png",
      );
      assert.equal(
        (
          await request(
            `/api/learning/files/${draftFile.id}`,
            null,
            studentCookie,
          )
        ).status,
        404,
      );
      assert.equal(
        (await request(`/api/learning/files/${visibleFile.id}`)).status,
        404,
      );
      const meta = {
        kind: "material",
        target: published,
        name: "slika.png",
        type: "image/png",
        size: png.length,
      };
      assert.equal(
        (
          await request("/api/learning/files/prepare", meta, cookie, {
            origin: "https://foreign.test",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "/api/learning/files/prepare",
            { ...meta, name: "unsafe.svg", type: "image/svg+xml" },
            cookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/api/learning/files/remove",
            { id: visibleFile.id },
            studentCookie,
          )
        ).status,
        403,
      );
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE)
    await check(
      "Chromium uploads PNG and real video directly to Storage, previews them and removes an attachment",
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
        page.on("response", async (response) => {
          if (
            response.status() >= 400 &&
            new URL(response.url()).pathname.startsWith("/api/learning/files/")
          )
            console.log(
              `Local attachment API status ${response.status()}: ${(await response.text()).slice(0, 300)}`,
            );
        });
        await page.goto(origin + "/?module=auth&next=merlin");
        await page
          .getByLabel("E-adresa", { exact: true })
          .fill(users.nastavnik.email);
        await page
          .getByLabel("Lozinka", { exact: true })
          .fill(users.nastavnik.password);
        await page
          .getByRole("button", { name: "Prijavi se", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("module") === "merlin");
        await page.goto(
          origin + `/?module=merlin&course=${f.courseA}&view=Materijali`,
        );
        const card = page
          .locator("article")
          .filter({
            has: page.getByRole("heading", {
              name: `Privitci ${tag}`,
              exact: true,
            }),
          })
          .filter({ hasNot: page.getByText("Nacrt", { exact: false }) });
        // Generate a short local video; no external content or student data.
        const videoPath = `/tmp/merlin-${tag}.webm`;
        execFileSync(
          "ffmpeg",
          [
            "-y",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=160x120:d=1",
            "-c:v",
            "libvpx",
            videoPath,
          ],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
        await card
          .getByLabel("Dodaj slike, videa ili dokumente")
          .setInputFiles([
            { name: "preglednik.png", mimeType: "image/png", buffer: png },
            {
              name: "predavanje.webm",
              mimeType: "video/webm",
              buffer: readFileSync(videoPath),
            },
            { name: "veliki-dokument.txt", mimeType: "text/plain", buffer: Buffer.alloc(6 * 1024 * 1024, "x") },
          ]);
        await card
          .getByRole("button", { name: "Učitaj privitke", exact: true })
          .click();
        await page.waitForFunction((title) => {
          const article = [...document.querySelectorAll("article")].find(
            (a) => a.querySelector("h3")?.textContent?.trim() === title,
          );
          const message =
            article?.querySelector('[role="status"]')?.textContent;
          return message && !message.startsWith("Učitavanje:");
        }, `Privitci ${tag}`);
        assert.equal(
          await card.getByRole("status").innerText(),
          "Privitci su spremljeni.",
        );
        await page.reload();
        const image = card.getByRole("img", {
          name: "preglednik.png",
          exact: true,
        });
        await image.waitFor({ state: "attached" });
        await image.scrollIntoViewIfNeeded();
        await page.waitForFunction(() =>
          [...document.images].some(
            (i) => i.alt === "preglednik.png" && i.naturalWidth > 0,
          ),
        );
        const video = card.locator("video");
        await video.evaluate((v) => {
          v.preload = "auto";
          v.load();
        });
        await page.waitForFunction(() =>
          [...document.querySelectorAll("video")].some(
            (v) => v.readyState >= 1 && v.videoWidth === 160,
          ),
        );
        await video.evaluate((v) => v.play());
        await page.waitForFunction(() =>
          [...document.querySelectorAll("video")].some(
            (v) => v.currentTime > 0,
          ),
        );
        page.once("dialog", (dialog) => dialog.accept());
        const attachment = card
          .locator("div")
          .filter({
            has: page.getByRole("link", {
              name: "Preuzmi: preglednik.png",
              exact: true,
            }),
          })
          .filter({
            has: page.getByRole("button", {
              name: "Ukloni privitak",
              exact: true,
            }),
          })
          .last();
        await attachment
          .getByRole("button", { name: "Ukloni privitak", exact: true })
          .click();
        await card
          .getByText("Privitak je uklonjen.", { exact: true })
          .waitFor();
        await page.reload();
        assert.equal(
          await card
            .getByRole("img", { name: "preglednik.png", exact: true })
            .count(),
          0,
        );
        // Assignment instructions have a separate uploader bound to the assignment id.
        await page.goto(
          origin + `/?module=merlin&course=${f.courseA}&view=Zadaci`,
        );
        const task = page.locator("article").filter({
          has: page.getByRole("heading", {
            name: `Datoteke zadatka ${tag}`,
            exact: true,
          }),
        });
        await task
          .getByLabel("Dodaj slike, videa ili dokumente")
          .setInputFiles({
            name: "zadatak.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Tekst uputa."),
          });
        await task
          .getByRole("button", { name: "Učitaj privitke", exact: true })
          .click();
        await task
          .getByText("Privitci su spremljeni.", { exact: true })
          .waitFor();
        await page.reload();
        await task
          .getByRole("link", { name: "Preuzmi: zadatak.txt", exact: true })
          .waitFor();
      },
    );
  await check(
    "unpublishing a parent removes fresh read access to the attachment",
    async () => {
      await ok(
        teacher.rpc("learning_save_material", {
          target_course: f.courseA,
          target: published,
          expected: 1,
          item_title: `Privitci ${tag}`,
          item_body: "Sadržaj s privitcima.",
          item_url: "",
          item_published: false,
        }),
      );
      assert.equal(
        (
          await request(
            `/api/learning/files/${visibleFile.id}`,
            null,
            studentCookie,
          )
        ).status,
        404,
      );
      assert.ok(
        (
          await student.storage
            .from("merlin-files")
            .download(visibleFile.object_path)
        ).error,
      );
    },
  );
  console.log(`${count} learning-file scenarios passed.`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill("SIGTERM");
  if (materials.length || assignments.length) {
    const all = await ok(
      service
        .from("learning_files")
        .select("id,object_path")
        .or(
          `material_id.in.(${materials.join(",")}),assignment_id.in.(${assignments.join(",")})`,
        ),
    );
    if (all.length) {
      await ok(
        service.storage
          .from("merlin-files")
          .remove(all.map((x) => x.object_path)),
      );
      await ok(
        service
          .from("learning_files")
          .delete()
          .in(
            "id",
            all.map((x) => x.id),
          ),
      );
    }
  }
  if (materials.length)
    await ok(service.from("learning_materials").delete().in("id", materials));
  if (assignments.length)
    await ok(
      service.from("learning_assignments").delete().in("id", assignments),
    );
}
