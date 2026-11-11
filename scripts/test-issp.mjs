import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
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
  admin = client(),
  student = client(),
  peer = client(),
  teacher = client();
const ok = async (p) => {
  const r = await p;
  assert.ifError(r.error);
  return r.data;
};
const denied = async (p, code) => {
  const r = await p;
  assert.ok(r.error);
  if (code) assert.ok(r.error.message.includes(code), r.error.message);
};
const tag = randomUUID().slice(0, 8),
  accounts = [],
  studies = [],
  paths = [],
  origin = "http://localhost:3016";
let year,
  server,
  browser,
  previousProfile,
  previousPreferences,
  peerMembership = false,
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
const args = (extra = {}) => ({
  inst: f.a,
  student: users.student.id,
  year_id: year,
  data: {
    dining_enabled: true,
    rights_level: "2",
    valid_from: "2026-01-01",
    valid_until: "2027-12-31",
    daily_support_cents: 534,
    reference: `OD-${tag}`,
    note: "Odluka vlastite evidencije.",
  },
  expected: 0,
  ...extra,
});
const post = (id, kind, amount, reference, extra = {}) =>
  admin.rpc("issp_post_transaction", {
    target_account: id,
    transaction_kind: kind,
    amount_cents: amount,
    receipt_total: kind === "purchase" ? amount + 100 : 0,
    item_provider: "Testna menza Čakovec",
    item_reference: reference,
    item_description: "Ručak — čćžšđ",
    item_date: new Date(Date.now() - 60000).toISOString(),
    ...extra,
  });
const current = (table, id) =>
  ok(admin.from(table).select("*").eq("id", id).single());
try {
  for (const [db, role] of [
    [admin, "admin"],
    [student, "student"],
    [peer, "student2"],
    [teacher, "nastavnik"],
  ])
    await ok(
      db.auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      }),
    );
  previousProfile = (
    await ok(
      service
        .from("issp_profiles")
        .select("*")
        .eq("institution_id", f.a)
        .eq("student_id", users.student.id),
    )
  )[0];
  previousPreferences = (
    await ok(
      service
        .from("issp_preferences")
        .select("*")
        .eq("institution_id", f.a)
        .eq("student_id", users.student.id),
    )
  )[0];
  year = (
    await ok(
      service
        .from("academic_years")
        .insert({
          institution_id: f.a,
          name: `ISSP-${tag}`,
          starts_on: "2026-01-01",
          ends_on: "2027-12-31",
        })
        .select("id")
        .single(),
    )
  ).id;
  const program = (
    await ok(
      service
        .from("student_studies")
        .select("program_id")
        .eq("institution_id", f.a)
        .eq("student_id", users.student.id)
        .limit(1),
    )
  )[0].program_id;
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
    peerMembership = true;
  }
  for (const subject of [users.student.id, users.student2.id])
    studies.push(
      (
        await ok(
          service
            .from("student_studies")
            .insert({
              institution_id: f.a,
              student_id: subject,
              program_id: program,
              academic_year_id: year,
              study_year: 1,
              student_number: `ISSP-${tag}-${subject.slice(0, 4)}`,
              status: "active",
            })
            .select("id")
            .single(),
        )
      ).id,
    );
  let account, peerAccount, allocation, purchase, reversal;
  await check(
    "students, peers and teachers cannot author rights; institution staff have scoped access",
    async () => {
      await denied(student.rpc("issp_save_account", args()), "ISSP_FORBIDDEN");
      await denied(teacher.rpc("issp_save_account", args()), "ISSP_FORBIDDEN");
      await denied(
        admin.rpc("issp_save_account", args({ inst: f.b })),
        "ISSP_FORBIDDEN",
      );
      account = await ok(admin.rpc("issp_save_account", args()));
      accounts.push(account);
      peerAccount = await ok(
        admin.rpc("issp_save_account", args({ student: users.student2.id })),
      );
      accounts.push(peerAccount);
      assert.equal(
        (await ok(student.from("issp_accounts").select("id").eq("id", account)))
          .length,
        1,
      );
      assert.deepEqual(
        await ok(peer.from("issp_accounts").select("id").eq("id", account)),
        [],
      );
      assert.deepEqual(
        await ok(teacher.from("issp_accounts").select("id").eq("id", account)),
        [],
      );
      await denied(admin.rpc("issp_save_account", args()), "ISSP_CONFLICT");
    },
  );
  await check(
    "record payloads are validated in SQL and sensitive records stay private",
    async () => {
      await denied(
        admin.rpc("issp_save_record", {
          target_account: account,
          record_kind: "employment",
          data: {
            status: "not_employed",
            description: "Izjava",
            checked_on: "2026-02-30",
          },
          evidence: "TEST-1",
        }),
      );
      await denied(
        admin.rpc("issp_save_record", {
          target_account: account,
          record_kind: "work_criterion",
          data: { criterion: "student", status: "yes", foreign: "no" },
          evidence: "TEST-2",
        }),
      );
      const id = await ok(
        admin.rpc("issp_save_record", {
          target_account: account,
          record_kind: "disability",
          data: {
            category: "Testna kategorija",
            description: "Testni zapis za provjeru privatnosti",
            consent: "yes",
          },
          evidence: `DI-${tag}`,
        }),
      );
      assert.equal(
        (await ok(student.from("issp_records").select("id").eq("id", id)))
          .length,
        1,
      );
      assert.deepEqual(
        await ok(peer.from("issp_records").select("id").eq("id", id)),
        [],
      );
      assert.deepEqual(
        await ok(teacher.from("issp_records").select("id").eq("id", id)),
        [],
      );
      await denied(
        student.from("issp_records").insert({
          institution_id: f.a,
          student_id: users.student.id,
          account_id: account,
          kind: "dorm",
          payload: { name: "Dom", type: "student" },
          reference: "BAD",
          updated_by: users.student.id,
        }),
      );
    },
  );
  await check(
    "the ledger prevents overspending, races and duplicate receipts; reversal preserves history",
    async () => {
      await denied(post(account, "purchase", 100, `NO-${tag}`), "ISSP_BALANCE");
      const date = new Date(Date.now() - 60000).toISOString();
      allocation = await ok(
        post(account, "allocation", 1000, `GR-${tag}`, { item_date: date }),
      );
      assert.equal(
        await ok(
          post(account, "allocation", 1000, `GR-${tag}`, { item_date: date }),
        ),
        allocation,
      );
      purchase = await ok(post(account, "purchase", 700, `RA-${tag}`));
      const raced = await Promise.all([
        post(account, "purchase", 200, `RC1-${tag}`),
        post(account, "purchase", 200, `RC2-${tag}`),
      ]);
      assert.equal(raced.filter((r) => !r.error).length, 1);
      assert.ok(
        raced.find((r) => r.error)?.error.message.includes("ISSP_BALANCE"),
      );
      await denied(
        post(account, "reversal", 0, `STGR-${tag}`, { original: allocation }),
        "ISSP_BALANCE",
      );
      reversal = await ok(
        post(account, "reversal", 0, `STRA-${tag}`, { original: purchase }),
      );
      assert.equal(
        (await current("issp_transactions", reversal)).delta_cents,
        700,
      );
      await denied(
        post(account, "reversal", 0, `ST2-${tag}`, { original: purchase }),
        "ISSP_REVERSED",
      );
      assert.equal(
        (
          await ok(
            student
              .from("issp_transactions")
              .select("delta_cents")
              .eq("account_id", account),
          )
        ).reduce((s, r) => s + r.delta_cents, 0),
        800,
      );
      await denied(
        student
          .from("issp_transactions")
          .update({ delta_cents: 99999 })
          .eq("id", purchase),
      );
    },
  );
  await check(
    "unapproved, expired and terminated rights block purchases independently of balance",
    async () => {
      let a = await current("issp_accounts", account);
      await ok(
        admin.rpc(
          "issp_save_account",
          args({
            expected: a.revision,
            data: { ...args().data, dining_enabled: false },
          }),
        ),
      );
      await denied(post(account, "purchase", 100, `DEN-${tag}`), "ISSP_RIGHTS");
      a = await current("issp_accounts", account);
      await ok(admin.rpc("issp_save_account", args({ expected: a.revision })));
      await denied(
        post(account, "purchase", 100, `DATE-${tag}`, {
          item_date: "2025-12-31T12:00:00Z",
        }),
        "ISSP_DATES",
      );
      const termination = await ok(
        admin.rpc("issp_save_record", {
          target_account: account,
          record_kind: "termination",
          data: { date: "2026-01-01", reason: "Test prestanka" },
          evidence: `PR-${tag}`,
        }),
      );
      await denied(post(account, "purchase", 100, `END-${tag}`), "ISSP_RIGHTS");
      await ok(
        admin.rpc("issp_save_record", {
          target_account: account,
          record_kind: "termination",
          data: { date: "2026-01-01", reason: "Test prestanka" },
          evidence: `PR-${tag}`,
          target: termination,
          expected: 1,
          item_active: false,
        }),
      );
    },
  );
  await check(
    "photo storage and notification settings belong only to the subject and scoped staff",
    async () => {
      const photo = `${f.a}/${users.student.id}/${randomUUID()}`;
      paths.push(photo);
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=",
        "base64",
      );
      await denied(
        student.storage
          .from("issp-photos")
          .upload(photo, png, { contentType: "image/png" }),
      );
      await ok(
        admin.storage
          .from("issp-photos")
          .upload(photo, png, { contentType: "image/png" }),
      );
      await ok(
        admin.rpc("issp_save_profile", {
          inst: f.a,
          student: users.student.id,
          item_phone: "010000000",
          item_photo: photo,
          expected: previousProfile?.revision || 0,
        }),
      );
      await ok(student.storage.from("issp-photos").createSignedUrl(photo, 60));
      await denied(peer.storage.from("issp-photos").createSignedUrl(photo, 60));
      await denied(
        teacher.storage.from("issp-photos").createSignedUrl(photo, 60),
      );
      await ok(
        student.rpc("issp_save_preferences", {
          inst: f.a,
          email_address: "student@example.test",
          approved: true,
          expected: previousPreferences?.revision || 0,
        }),
      );
      assert.deepEqual(
        await ok(
          peer
            .from("issp_preferences")
            .select("*")
            .eq("student_id", users.student.id),
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
      "3016",
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
  const cookies = {};
  for (const role of ["student", "admin", "nastavnik"]) {
    const r = await request("/api/auth/login", {
      email: users[role].email,
      password: users[role].password,
      next: "issp",
    });
    assert.equal(r.status, 303);
    cookies[role] = r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
  }
  await check(
    "HTTP enforces own-student scope, CSRF, private photographs and actual PDF download",
    async () => {
      const scope = `institution=${f.a}&student=${users.student.id}&academic_year=${year}`;
      const html = await request(
        `/?module=issp&${scope}`,
        null,
        cookies.student,
      );
      assert.equal(html.status, 200);
      assert.ok((await html.text()).includes("Raspoloživi saldo"));
      const otherStudent = await request(
        `/?module=issp&institution=${f.a}&student=${users.student2.id}`,
        null,
        cookies.student,
      );
      const otherHTML = await otherStudent.text();
      assert.ok([200, 404].includes(otherStudent.status));
      assert.ok(otherHTML.includes("404"));
      assert.ok(!otherHTML.includes("Raspoloživi saldo"));
      const dining = await request(
        `/?module=studomat&institution=${f.a}&academic_year=${year}&view=Razina+prava+na+prehranu`,
        null,
        cookies.student,
      );
      const diningHTML = await dining.text();
      assert.ok(diningHTML.includes("ISSP evidencija referade"));
      assert.ok(diningHTML.includes(`OD-${tag}`));
      const teacherHTML = await (
        await request(`/?module=issp&${scope}`, null, cookies.nastavnik)
      ).text();
      assert.ok(teacherHTML.includes("Pristup nije dopušten"));
      assert.ok(!teacherHTML.includes("Testna kategorija"));
      assert.equal(
        (
          await request(
            "/api/issp/account",
            { institution_id: f.a },
            cookies.student,
            { origin: "https://foreign.test" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/api/issp/photo?institution=${f.a}&student=${users.student.id}`,
            null,
            cookies.student,
          )
        ).status,
        307,
      );
      assert.equal(
        (
          await request(
            `/api/issp/photo?institution=${f.a}&student=${users.student2.id}`,
            null,
            cookies.student,
          )
        ).status,
        404,
      );
      const beforePhoto = await ok(
        service
          .from("issp_profiles")
          .select("revision,photo_path")
          .eq("institution_id", f.a)
          .eq("student_id", users.student.id)
          .single(),
      );
      const malformedPhoto = new FormData();
      malformedPhoto.set("institution_id", f.a);
      malformedPhoto.set("student_id", users.student.id);
      malformedPhoto.set("revision", String(beforePhoto.revision));
      malformedPhoto.set("phone", "");
      malformedPhoto.set(
        "photo",
        new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])], {
          type: "image/png",
        }),
        "bad.png",
      );
      const malformedResponse = await fetch(origin + "/api/issp/photo", {
        method: "POST",
        headers: { origin, cookie: cookies.admin },
        body: malformedPhoto,
        redirect: "manual",
      });
      assert.equal(malformedResponse.status, 403);
      assert.equal(
        (
          await ok(
            service
              .from("issp_profiles")
              .select("photo_path")
              .eq("institution_id", f.a)
              .eq("student_id", users.student.id)
              .single(),
          )
        ).photo_path,
        beforePhoto.photo_path,
      );
      const pdf = await request(
        `/api/issp/export?institution=${f.a}&student=${users.student.id}`,
        null,
        cookies.student,
      );
      assert.equal(pdf.status, 200);
      assert.equal(pdf.headers.get("content-type"), "application/pdf");
      const bytes = Buffer.from(await pdf.arrayBuffer());
      assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
      const file = `/tmp/issp-${tag}.pdf`;
      writeFileSync(file, bytes);
      const text = execFileSync("pdftotext", [file, "-"], { encoding: "utf8" });
      assert.ok(text.includes("Čakovec"));
      assert.ok(text.includes("čćžšđ"));
      assert.ok(text.includes(`GR-${tag}`));
      assert.equal(
        (
          await request(
            `/api/issp/export?institution=${f.a}&student=${users.student2.id}`,
            null,
            cookies.student,
          )
        ).status,
        403,
      );
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE)
    await check(
      "Chromium staff records a dorm, student sees own dossier and preferences, PDF and mobile layout work",
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
          await page.goto(origin + "/?module=auth&next=issp");
          await page
            .getByLabel("E-adresa", { exact: true })
            .fill(users[role].email);
          await page
            .getByLabel("Lozinka", { exact: true })
            .fill(users[role].password);
          await page
            .getByRole("button", { name: "Prijavi se", exact: true })
            .click();
          await page.waitForURL((u) => u.searchParams.get("module") === "issp");
        };
        await login("admin");
        await page.goto(
          origin +
            `/?module=issp&institution=${f.a}&student=${users.student.id}&academic_year=${year}&view=Upravljanje+evidencijom`,
        );
        const rightsForm = page.locator('form[action="/api/issp/account"]');
        await rightsForm.getByLabel("Razina prava", { exact: true }).fill("2");
        await rightsForm
          .getByRole("button", { name: "Spremi prava i račun", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        await page.getByRole("status").waitFor();
        const transactionForm = page.locator(
          'form[action="/api/issp/transaction"]',
        );
        await transactionForm
          .getByLabel("Vrsta zapisa", { exact: true })
          .selectOption("purchase");
        await transactionForm
          .getByLabel("Iznos potpore EUR (dodjela ili potrošnja)", {
            exact: true,
          })
          .fill("0,50");
        await transactionForm
          .getByLabel("Ukupan iznos računa EUR (za dodjelu: 0)", {
            exact: true,
          })
          .fill("1,50");
        await transactionForm
          .getByLabel("Prodajno mjesto / izvor dodjele", { exact: true })
          .fill("Testna menza");
        await transactionForm
          .getByLabel("Jedinstveni broj računa / oznaka dodjele", {
            exact: true,
          })
          .fill(`WEB-${tag}`);
        await transactionForm
          .getByRole("button", { name: "Evidentiraj transakciju", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        await page.getByRole("status").waitFor();
        await page
          .getByText("Dodaj zapis · Dom studenta", { exact: true })
          .click();
        const dormForm = page
          .locator('form[action="/api/issp/record"]')
          .filter({ has: page.getByLabel("Naziv doma", { exact: true }) })
          .last();
        await dormForm
          .getByLabel("Naziv doma", { exact: true })
          .fill(`Dom ${tag}`);
        await dormForm
          .getByLabel("Vrsta", { exact: true })
          .selectOption("student");
        await dormForm
          .getByLabel("Izvor provjere / oznaka odluke", { exact: true })
          .fill(`DOM-${tag}`);
        await dormForm
          .getByRole("button", { name: "Spremi evidenciju", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        const photoForm = page.locator('form[action="/api/issp/photo"]');
        await photoForm
          .getByLabel("Fotografija studenta", { exact: true })
          .setInputFiles({
            name: "photo.png",
            mimeType: "image/png",
            buffer: Buffer.from(
              await page.evaluate(() => {
                const canvas = document.createElement("canvas");
                canvas.width = 300;
                canvas.height = 360;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#f1f5f9";
                ctx.fillRect(0, 0, 300, 360);
                ctx.fillStyle = "#94a3b8";
                ctx.beginPath();
                ctx.arc(150, 125, 65, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(150, 315, 110, 115, 0, 0, Math.PI * 2);
                ctx.fill();
                return canvas.toDataURL("image/png").split(",")[1];
              }),
              "base64",
            ),
          });
        await photoForm
          .getByRole("button", { name: "Spremi fotografiju", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        const photoRow = await ok(
          service
            .from("issp_profiles")
            .select("photo_path")
            .eq("institution_id", f.a)
            .eq("student_id", users.student.id)
            .single(),
        );
        paths.push(photoRow.photo_path);
        await login("student");
        await page.goto(
          origin + `/?module=issp&institution=${f.a}&academic_year=${year}`,
        );
        await page.getByRole("heading", { level: 1 }).waitFor();
        await page.getByText(`Dom ${tag}`, { exact: true }).waitFor();
        await page.getByRole("img", { name: /Fotografija:/ }).waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('img[alt^="Fotografija:"]');
          return image?.complete && image.naturalWidth > 0;
        });
        assert.equal(
          await page
            .getByRole("link", { name: "Upravljanje evidencijom", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await page.locator('form[action="/api/issp/account"]').count(),
          0,
        );
        await page.screenshot({
          path: "/tmp/isvu-issp-personal.png",
          fullPage: true,
        });
        await page
          .getByRole("link", { name: "Osobni računi", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Osobni računi", exact: true })
          .waitFor();
        await page.screenshot({
          path: "/tmp/isvu-issp-receipts.png",
          fullPage: true,
        });
        await page
          .getByRole("link", { name: "Postavke obavijesti", exact: true })
          .click();
        await page
          .getByLabel("E-mail adresa za obavijesti", { exact: true })
          .fill("student2@example.test");
        await page
          .getByRole("button", { name: "Spremi postavke", exact: true })
          .click();
        await page.waitForURL((u) => u.searchParams.get("status") === "saved");
        await page.getByRole("status").waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(
          origin + `/?module=issp&institution=${f.a}&academic_year=${year}`,
        );
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.screenshot({
          path: "/tmp/isvu-issp-mobile.png",
          fullPage: true,
        });
      },
    );
  console.log(`${count} ISSP scenarios passed.`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill("SIGTERM");
  if (paths.length) await ok(service.storage.from("issp-photos").remove(paths));
  for (const [table, previous] of [
    ["issp_profiles", previousProfile],
    ["issp_preferences", previousPreferences],
  ]) {
    if (previous)
      await ok(service.from(table).update(previous).eq("id", previous.id));
    else
      await ok(
        service
          .from(table)
          .delete()
          .eq("institution_id", f.a)
          .eq("student_id", users.student.id),
      );
  }
  if (accounts.length) {
    await ok(service.from("issp_records").delete().in("account_id", accounts));
    await ok(
      service.from("issp_transactions").delete().in("account_id", accounts),
    );
    await ok(service.from("issp_accounts").delete().in("id", accounts));
  }
  if (studies.length)
    await ok(service.from("student_studies").delete().in("id", studies));
  if (year) await ok(service.from("academic_years").delete().eq("id", year));
  if (peerMembership)
    await ok(
      service
        .from("memberships")
        .delete()
        .eq("institution_id", f.a)
        .eq("user_id", users.student2.id)
        .eq("role", "student"),
    );
}
