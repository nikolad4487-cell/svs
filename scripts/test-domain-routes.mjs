import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(c.API_URL).hostname));
const users = JSON.parse(readFileSync(".local-test-users.json")),
  f = JSON.parse(readFileSync(".local-academic.json"));
const service = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ok = async (p) => {
  const r = await p;
  assert.ifError(r.error);
  return r.data;
};
const port = 3011,
  tag = randomUUID().slice(0, 8),
  aSlug = `route-ufzg-${tag}`,
  bSlug = `route-geofzg-${tag}`;
const old = await ok(
  service
    .from("institutions")
    .select("id,name,code,url_slug")
    .in("id", [f.a, f.b]),
);
let server,
  count = 0,
  added = [];
const check = async (name, fn) => {
  await fn();
  console.log(`PASS ${name}`);
  count++;
};
function request(host, path, fields, cookie = "", extra = {}) {
  return new Promise((resolve, reject) => {
    const body = fields ? new URLSearchParams(fields).toString() : "";
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: fields ? "POST" : "GET",
        headers: {
          host,
          cookie,
          origin: `https://${host}`,
          ...extra,
          ...(fields
            ? {
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (res) => {
        let text = "";
        res.on("data", (x) => (text += x));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, text }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}
const H = (sub) => `${sub ? sub + "." : ""}isvu.me:${port}`;
const cookies = {};
try {
  await ok(
    service.from("institutions").update({ url_slug: aSlug }).eq("id", f.a),
  );
  await ok(
    service.from("institutions").update({ url_slug: bSlug }).eq("id", f.b),
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
        BASE_DOMAIN: "isvu.me",
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
      if ((await request(H(""), "/")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready);
  await check(
    "central portal and both administrations route to login with the correct authorized module",
    async () => {
      for (const [path, module] of [
        ["/admin", "portal"],
        ["/admin/studiji", "isvu"],
        ["/admin/sustav", "admin"],
      ]) {
        const r = await request(H(""), path);
        assert.equal(r.status, 307, path);
        const to = new URL(r.headers.location);
        assert.equal(to.hostname, "auth.isvu.me");
        assert.equal(to.searchParams.get("next"), module);
      }
      for (const [sub, path] of [
        ["portal", "/admin"],
        ["isvu", "/admin/studiji"],
        ["admin", "/admin/sustav"],
      ]) {
        const r = await request(H(sub), "/");
        assert.equal(r.status, 308);
        assert.equal(new URL(r.headers.location).pathname, path);
      }
    },
  );
  await check(
    "faculty path is preserved through failed and successful central login with shared secure cookies",
    async () => {
      const r = await request(H("raspored"), `/${aSlug}`);
      assert.equal(r.status, 307);
      const target = new URL(r.headers.location);
      assert.equal(target.searchParams.get("faculty"), aSlug);
      const login = await request(
        H("auth"),
        `/?next=raspored&faculty=${aSlug}`,
      );
      assert.ok(login.text.includes(`name="faculty" value="${aSlug}"`));
      const denied = await request(H("auth"), "/api/auth/login", {
        email: users.student.email,
        password: "wrong",
        next: "raspored",
        faculty: aSlug,
      });
      assert.equal(
        new URL(denied.headers.location).searchParams.get("faculty"),
        aSlug,
      );
      for (const role of ["student", "referada", "nastavnik", "superadmin"]) {
        const response = await request(H("auth"), "/api/auth/login", {
          email: users[role].email,
          password: users[role].password,
          next: role === "student" ? "raspored" : "referada",
          ...(role === "student" ? { faculty: aSlug } : {}),
        });
        assert.equal(response.status, 303);
        cookies[role] = (response.headers["set-cookie"] || [])
          .map((x) => x.split(";")[0])
          .join("; ");
        assert.ok(
          response.headers["set-cookie"].some(
            (x) =>
              /domain=\.isvu\.me/i.test(x) &&
              /secure/i.test(x) &&
              /httponly/i.test(x),
          ),
        );
        if (role === "student")
          assert.equal(
            new URL(response.headers.location).pathname,
            `/${aSlug}`,
          );
      }
    },
  );
  await check(
    "named timetable remains scoped to its institution, including header/query tampering",
    async () => {
      const own = await request(
        H("raspored"),
        `/${aSlug}`,
        null,
        cookies.student,
      );
      assert.equal(own.status, 200);
      assert.ok(own.text.includes(old.find((x) => x.id === f.a).name));
      assert.ok(own.text.includes(`/${aSlug}?`));
      const foreign = await request(
        H("raspored"),
        `/${bSlug}`,
        null,
        cookies.student,
      );
      assert.match(foreign.text, /404|NEXT_HTTP_ERROR_FALLBACK/);
      const mismatch = await request(
        H("raspored"),
        `/${aSlug}?institution=${f.b}`,
        null,
        cookies.student,
      );
      assert.match(mismatch.text, /404|NEXT_HTTP_ERROR_FALLBACK/);
      const spoof = await request(
        H("raspored"),
        `/${aSlug}`,
        null,
        cookies.student,
        { "x-svs-faculty": bSlug },
      );
      assert.ok(spoof.text.includes(old.find((x) => x.id === f.a).name));
      const room = await ok(
        service
          .from("rooms")
          .select("id,name,capacity")
          .eq("id", f.roomA)
          .single(),
      );
      const mutation = await request(
        H("raspored"),
        "/api/academic/room",
        {
          institution_id: f.a,
          return_module: "raspored",
          return_view: "Dvorane",
          id: room.id,
          name: room.name,
          capacity: String(room.capacity),
        },
        cookies.referada,
      );
      assert.equal(mutation.status, 303);
      assert.equal(new URL(mutation.headers.location).pathname, `/${aSlug}`);
      assert.equal(
        new URL(mutation.headers.location).searchParams.get("status"),
        "saved",
      );
      const invalid = await request(H("raspored"), "/sites/admin");
      assert.equal(invalid.status, 404);
      const portal = await request(H(""), "/admin", null, cookies.student);
      assert.equal(portal.status, 200);
      assert.ok(!portal.text.includes("Pristup nije dopušten"));
      const admin = await request(
        H(""),
        "/admin/sustav",
        null,
        cookies.student,
      );
      assert.ok(admin.text.includes("Pristup nije dopušten"));
    },
  );
  const addRole = async (user, inst, role) => {
    const existing = await ok(
      service
        .from("memberships")
        .select("user_id")
        .match({ institution_id: inst, user_id: users[user].id, role }),
    );
    if (!existing.length) {
      await ok(
        service
          .from("memberships")
          .insert({ institution_id: inst, user_id: users[user].id, role }),
      );
      added.push({ institution_id: inst, user_id: users[user].id, role });
    }
  };
  await check(
    "referada opens the only staff institution and requires a choice for multiple staff institutions",
    async () => {
      const single = await request(H("referada"), "/", null, cookies.referada);
      assert.equal(single.status, 200);
      assert.ok(single.text.includes("Radni prostor referade"));
      assert.ok(!single.text.includes("Imate ovlasti na više ustanova"));
      await addRole("nastavnik", f.b, "registrar");
      const staff = await request(H("referada"), "/", null, cookies.nastavnik);
      assert.ok(staff.text.includes(old.find((x) => x.id === f.b).name));
      assert.ok(!staff.text.includes(`value="${f.a}"`));
      await addRole("referada", f.b, "registrar");
      const multiple = await request(
        H("referada"),
        "/",
        null,
        cookies.referada,
      );
      assert.ok(multiple.text.includes("Imate ovlasti na više ustanova"));
      assert.ok(!multiple.text.includes('action="/api/registrar/invite"'));
      const chosen = await request(
        H("referada"),
        `/?institution=${f.b}`,
        null,
        cookies.referada,
      );
      assert.ok(chosen.text.includes("Radni prostor referade"));
    },
  );
  await check(
    "students cannot rename institution paths and administrator edits retain stable unique labels",
    async () => {
      const db = createClient(c.API_URL, c.ANON_KEY, {
        auth: { persistSession: false },
      });
      await ok(db.auth.signInWithPassword(users.student));
      const result = await db
        .from("institutions")
        .update({ url_slug: "forged" })
        .eq("id", f.a)
        .select();
      assert.ok(result.error || result.data.length === 0);
      assert.equal(
        (
          await service
            .from("institutions")
            .update({ url_slug: aSlug })
            .eq("id", f.b)
        ).error.code,
        "23505",
      );
      await ok(
        service
          .from("institutions")
          .update({ name: old.find((x) => x.id === f.a).name })
          .eq("id", f.a),
      );
      assert.equal(
        (
          await ok(
            service
              .from("institutions")
              .select("url_slug")
              .eq("id", f.a)
              .single(),
          )
        ).url_slug,
        aSlug,
      );
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE) {
    await check(
      "Chromium local faculty link survives central login and keeps timetable navigation on the same path",
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
            viewport: { width: 1280, height: 900 },
          });
          await page.goto(`http://localhost:${port}/${aSlug}?module=raspored`);
          await page.locator("input[name=email]").fill(users.student.email);
          await page
            .locator("input[name=password]")
            .fill(users.student.password);
          await Promise.all([
            page.waitForNavigation(),
            page
              .getByRole("button", { name: "Prijavi se", exact: true })
              .click(),
          ]);
          await page
            .getByText("Raspored ustanove:", { exact: false })
            .waitFor();
          assert.equal(new URL(page.url()).pathname, `/${aSlug}`);
          await page
            .getByRole("link", { name: "Kalendar", exact: true })
            .click();
          await page
            .getByText("Raspored ustanove:", { exact: false })
            .waitFor();
          assert.equal(new URL(page.url()).pathname, `/${aSlug}`);
          await page.screenshot({
            path: "/tmp/isvu-faculty-route.png",
            fullPage: true,
          });
        } finally {
          await browser.close();
        }
      },
    );
  }
  console.log(
    `${count} domain-routing and institution-scope scenarios passed.`,
  );
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => {
      if (server.exitCode !== null) r();
      else server.once("exit", r);
    });
  }
  for (const row of added)
    await ok(service.from("memberships").delete().match(row));
  for (const row of old)
    await ok(
      service
        .from("institutions")
        .update({ url_slug: row.url_slug })
        .eq("id", row.id),
    );
}
