import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(c.API_URL).hostname));
const rows = JSON.parse(
    readFileSync("data/institutions/catalog-125.json", "utf8"),
  ),
  bindings = JSON.parse(
    readFileSync("data/institutions/legacy-bindings.json", "utf8"),
  ),
  users = JSON.parse(readFileSync(".local-test-users.json"));
const db = (key = c.ANON_KEY) =>
  createClient(c.API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = db(c.SERVICE_ROLE_KEY),
  anonymous = db(),
  student = db(),
  peer = db(),
  superadmin = db(),
  admin = db();
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
  port = 3017,
  H = (sub) => (sub ? sub + "." : "") + "isvu.me:" + port;
let server,
  browser,
  count = 0;
const addedMembers = [],
  programs = [],
  years = [],
  semesters = [],
  courses = [],
  studies = [],
  enrollments = [];
let metadataBefore;
const check = async (name, fn) => {
  await fn();
  count++;
  console.log("PASS " + name);
};
const request = (host, path, body, cookie = "", extra = {}) =>
  new Promise((resolve, reject) => {
    const text = body ? new URLSearchParams(body).toString() : "";
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: body ? "POST" : "GET",
        headers: {
          host,
          cookie,
          origin: "https://" + host,
          ...extra,
          ...(body
            ? {
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(text),
              }
            : {}),
        },
      },
      (res) => {
        let text = "";
        res.on("data", (d) => (text += d));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, text }),
        );
      },
    );
    r.on("error", reject);
    r.end(text);
  });
const bySlug = async (slug) =>
  await ok(
    service.from("institutions").select("*").eq("subdomain", slug).single(),
  );
const saveArgs = (r, extra = {}) => ({
  target: r.id,
  data: {
    name: r.name,
    short_name: r.short_name,
    headquarters: r.headquarters,
    address: r.address || "",
    official_website: r.official_website || "",
    website_verification_status: r.website_verification_status,
    subdomain: r.subdomain,
    domain_verification_status: r.domain_verification_status,
    domain_notes: r.domain_notes,
    parent_institution_id: r.parent_institution_id || "",
    registry_metadata_locked: true,
    active: r.active,
    updated_at: r.updated_at,
    ...extra,
  },
});
const sql = (source) =>
  execFileSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "-i",
      c.DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: source, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
try {
  for (const [client, role] of [
    [student, "student"],
    [peer, "student2"],
    [superadmin, "superadmin"],
    [admin, "admin"],
  ])
    await ok(
      client.auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      }),
    );
  await check(
    "125 stable catalog records survive repeated imports; namesakes and parent institutions remain distinct",
    async () => {
      const before = await ok(
        service
          .from("institutions")
          .select("id,registry_key,subdomain,updated_at")
          .not("registry_key", "is", null)
          .order("registry_key"),
      );
      assert.equal(before.length, 125);
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await ok(
              service.rpc("import_institution_catalog", {
                items: rows,
                legacy_bindings: bindings,
              }),
            )
          ).catalog_count,
          125,
        );
      assert.deepEqual(
        await ok(
          service
            .from("institutions")
            .select("id,registry_key,subdomain,updated_at")
            .not("registry_key", "is", null)
            .order("registry_key"),
        ),
        before,
      );
      const filo = await ok(
        service
          .from("institutions")
          .select("id,parent_institution_id")
          .eq("registry_name", "Filozofski fakultet"),
      );
      assert.equal(filo.length, 4);
      assert.equal(new Set(filo.map((r) => r.parent_institution_id)).size, 4);
      const sourceIds = await ok(
        service
          .from("institutions")
          .select("isvu_institution_id")
          .not("isvu_institution_id", "is", null),
      );
      assert.equal(
        new Set(sourceIds.map((r) => r.isvu_institution_id)).size,
        sourceIds.length,
      );
    },
  );
  await check("short-label correction renames generated labels once and preserves manual overrides and tenant identities", async () => {
    const prior = JSON.parse(readFileSync("data/institutions/previous-generated-labels.json", "utf8"));
    const correction = readFileSync("supabase/migrations/202611110004_institution_short_labels.sql", "utf8");
    const ferito = rows.find(r=>r.registry_key==="hr-isvu-125:017");
    sql(`begin;
      update public.institutions set subdomain='${prior[ferito.registry_key]}', url_slug='${prior[ferito.registry_key]}', short_name=upper('${prior[ferito.registry_key]}'), domain_origin='provisional_name', registry_metadata_locked=false where registry_key='${ferito.registry_key}';
      update public.institutions set subdomain='manual-${tag}', domain_origin='manual', registry_metadata_locked=true where registry_key='hr-isvu-125:001';
      ${correction}
      ${correction}
      do $test$ begin
       if not exists(select 1 from public.institutions where registry_key='${ferito.registry_key}' and id='${ferito.id}' and subdomain='ferito' and url_slug='ferito' and short_name='FERITO') then raise exception 'FERITO_CORRECTION_FAILED'; end if;
       if not exists(select 1 from public.institutions where registry_key='hr-isvu-125:001' and subdomain='manual-${tag}' and registry_metadata_locked) then raise exception 'MANUAL_OVERRIDE_LOST'; end if;
      end $test$;
      rollback;`);
  });
  await check(
    "explicit UFZG binding preserves established IDs, members, email rules and academic records in an isolated rollback",
    async () => {
      const source = rows.find((r) => r.registry_key === "hr-isvu-125:102"),
        binding = bindings[source.registry_key],
        escaped = JSON.stringify([source]).replaceAll("'", "''"),
        maps = JSON.stringify(bindings).replaceAll("'", "''");
      const present = await ok(
        service.from("institutions").select("id").eq("id", binding.id),
      );
      assert.equal(
        present.length,
        0,
        "Local fixture must not contain the production ID before the rollback test.",
      );
      sql(`begin;
   update public.institutions set registry_key=null,subdomain=null,url_slug='test-unbound-${tag}' where registry_key='hr-isvu-125:102';
   insert into public.institutions(id,name,code,headquarters,url_slug,email_domains,active) values('${binding.id}','Učiteljski fakultet, Zagreb','UFZG','Zagreb','ufzg',array['local.example'],false);
   insert into public.memberships(institution_id,user_id,role) values('${binding.id}','${users.student.id}','student');
   insert into public.academic_years(institution_id,name,starts_on,ends_on) values('${binding.id}','Binding-test','2026-01-01','2026-12-31');
   select public.import_institution_catalog('${escaped}'::jsonb,'${maps}'::jsonb);
   do $$ begin
    if not exists(select 1 from public.institutions where registry_key='hr-isvu-125:102' and id='${binding.id}' and name='Učiteljski fakultet, Zagreb' and not active and email_domains=array['local.example'] and parent_institution_id is not null) then raise exception 'Legacy institution was overwritten'; end if;
    if not exists(select 1 from public.memberships where institution_id='${binding.id}' and user_id='${users.student.id}') then raise exception 'Membership was lost'; end if;
    if not exists(select 1 from public.academic_years where institution_id='${binding.id}' and name='Binding-test') then raise exception 'Academic data was lost'; end if;
   end $$;rollback;`);
    },
  );
  await check(
    "public directory exposes no private records and ordinary administrators cannot bypass metadata restrictions",
    async () => {
      const catalog = await ok(anonymous.rpc("institution_directory"));
      assert.equal(catalog.length, 125);
      assert.ok(!JSON.stringify(catalog).includes("email_domains"));
      const fer = catalog.find((r) => r.subdomain === "fer");
      assert.equal(fer.name, "Fakultet elektrotehnike i računarstva");
      assert.equal(fer.domain_verification_status, "requires_verification");
      await denied(
        anonymous.rpc("import_institution_catalog", { items: rows }),
      );
      await denied(
        student.rpc("import_institution_catalog", { items: rows }),
        "REGISTRY_FORBIDDEN",
      );
      await denied(
        admin.rpc("save_institution_registry", saveArgs(await bySlug("fer"))),
        "REGISTRY_FORBIDDEN",
      );
      const own = (await ok(admin.from("institutions").select("*")))[0];
      await denied(
        admin
          .from("institutions")
          .update({ subdomain: "unapproved-" + tag })
          .eq("id", own.id),
        "REGISTRY_FORBIDDEN",
      );
    },
  );
  const fer = await bySlug("fer"),
    vuka = await bySlug("vuka");
  for (const [institution, subject] of [
    [fer, users.student],
    [vuka, users.student2],
  ]) {
    await ok(
      service.from("memberships").insert({
        institution_id: institution.id,
        user_id: subject.id,
        role: "student",
      }),
    );
    addedMembers.push({
      institution_id: institution.id,
      user_id: subject.id,
      role: "student",
    });
    const program = await ok(
      service
        .from("study_programs")
        .insert({
          institution_id: institution.id,
          name: "Tenant program " + tag,
          code: "T-" + tag,
          degree: "Prijediplomski",
          duration_years: 3,
        })
        .select("id")
        .single(),
    );
    programs.push(program.id);
    const year = await ok(
      service
        .from("academic_years")
        .insert({
          institution_id: institution.id,
          name: "Tenant-" + tag,
          starts_on: "2026-01-01",
          ends_on: "2027-12-31",
        })
        .select("id")
        .single(),
    );
    years.push(year.id);
    const semester = await ok(
      service
        .from("semesters")
        .insert({
          institution_id: institution.id,
          academic_year_id: year.id,
          name: "Tenant semestar",
          starts_on: "2026-01-01",
          ends_on: "2027-12-31",
        })
        .select("id")
        .single(),
    );
    semesters.push(semester.id);
    const course = await ok(
      service
        .from("courses")
        .insert({
          institution_id: institution.id,
          program_id: program.id,
          semester_id: semester.id,
          name:
            (institution.id === fer.id ? "FER private " : "VUKA private ") +
            tag,
          code: "TEN-" + tag,
          ects: 5,
        })
        .select("id")
        .single(),
    );
    courses.push(course.id);
    const study = await ok(
      service
        .from("student_studies")
        .insert({
          institution_id: institution.id,
          student_id: subject.id,
          program_id: program.id,
          academic_year_id: year.id,
          study_year: 1,
          student_number: "TEN-" + tag,
          status: "active",
        })
        .select("id")
        .single(),
    );
    studies.push(study.id);
    enrollments.push(
      (
        await ok(
          service
            .from("course_enrollments")
            .insert({
              institution_id: institution.id,
              study_id: study.id,
              course_id: course.id,
              student_id: subject.id,
            })
            .select("id")
            .single(),
        )
      ).id,
    );
  }
  await check(
    "FER student cannot read VUKA students, courses or identities by changing database filters",
    async () => {
      assert.equal(
        (await ok(student.from("courses").select("id").eq("id", courses[0])))
          .length,
        1,
      );
      assert.deepEqual(
        await ok(student.from("courses").select("*").eq("id", courses[1])),
        [],
      );
      assert.deepEqual(
        await ok(
          student.from("student_studies").select("*").eq("id", studies[1]),
        ),
        [],
      );
      assert.deepEqual(
        await ok(
          student
            .from("course_enrollments")
            .select("*")
            .eq("id", enrollments[1]),
        ),
        [],
      );
      await denied(
        student.rpc("learning_save_material", {
          target_course: courses[1],
          item_title: "Foreign change",
          item_body: "Should be blocked",
          item_url: "",
          item_published: true,
        }),
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
      String(port),
    ],
    {
      env: {
        ...process.env,
        BASE_DOMAIN: "isvu.me",
        LOCAL_BASE_DOMAIN: "isvu.test",
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
      if ((await request(H(""), "/")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready);
  await check(
    "FER, FHS and VUKA hosts resolve from the database, ignore forged tenant headers and reject unknown/API paths",
    async () => {
      for (const [slug, name] of [
        ["fer", "Fakultet elektrotehnike i računarstva"],
        ["fhs", "Fakultet hrvatskih studija"],
        ["vuka", "Veleučilište u Karlovcu"],
      ]) {
        const response = await request(
          H(slug),
          "/?institution=" + vuka.id,
          null,
          "",
          { "x-svs-tenant": "vuka", "x-svs-institution": vuka.id },
        );
        assert.equal(response.status, 200);
        assert.ok(response.text.includes(name));
        assert.ok(response.text.includes("institution%3D") === false);
        assert.ok(response.text.includes("Prijava za ovu ustanovu"));
      }
      for (const [host, path] of [
        [H("missing-" + tag), "/"],
        [H("fer"), "/api/academic/program"],
        [H("fer"), "/tenant"],
        ["fer.isvu.me.evil.test:" + port, "/"],
      ]) {
        const r = await request(host, path);
        assert.equal(r.status, 404, host + path);
      }
    },
  );
  let cookie;
  await check(
    "central login retains the institution, rejects foreign membership and scopes Merlin to the selected school",
    async () => {
      const blocked = await request(H("auth"), "/api/auth/login", {
        email: users.student.email,
        password: users.student.password,
        next: "portal",
        institution: vuka.id,
      });
      assert.equal(blocked.status, 303);
      assert.equal(
        new URL(blocked.headers.location).searchParams.get("status"),
        "institution-denied",
      );
      const r = await request(H("auth"), "/api/auth/login", {
        email: users.student.email,
        password: users.student.password,
        next: "portal",
        institution: fer.id,
      });
      assert.equal(r.status, 303);
      assert.equal(
        new URL(r.headers.location).searchParams.get("institution"),
        fer.id,
      );
      assert.ok(
        r.headers["set-cookie"].some((value) =>
          /domain=\.isvu\.me/i.test(value),
        ),
      );
      cookie = r.headers["set-cookie"].map((x) => x.split(";")[0]).join("; ");
      const foreign = await request(
        H("studomat"),
        "/?institution=" + vuka.id,
        null,
        cookie,
      );
      assert.ok(foreign.status === 404 || foreign.text.includes("404"));
      assert.ok(!foreign.text.includes("VUKA private " + tag));
      const learning = await request(
        H("merlin"),
        "/?institution=" + fer.id,
        null,
        cookie,
      );
      assert.equal(learning.status, 200);
      assert.ok(learning.text.includes("FER private " + tag));
      assert.ok(!learning.text.includes("VUKA private " + tag));
    },
  );
  await check(
    "administrator changes take effect without deployment, reject collisions/cycles and survive subsequent imports",
    async () => {
      metadataBefore = await bySlug("fer");
      const newSlug = "fer-review-" + tag;
      await ok(
        superadmin.rpc(
          "save_institution_registry",
          saveArgs(metadataBefore, {
            subdomain: newSlug,
            official_website: "https://manual.example",
            website_verification_status: "admin_verified",
            domain_verification_status: "admin_verified",
          }),
        ),
      );
      await denied(
        superadmin.rpc(
          "save_institution_registry",
          saveArgs(metadataBefore, { subdomain: "fer-old-" + tag }),
        ),
        "REGISTRY_CONFLICT",
      );
      const changed = await bySlug(newSlug);
      assert.equal((await request(H("fer"), "/")).status, 404);
      assert.equal((await request(H(newSlug), "/")).status, 200);
      await denied(
        superadmin.rpc(
          "save_institution_registry",
          saveArgs(changed, { subdomain: "vuka" }),
        ),
      );
      await denied(
        superadmin.rpc(
          "save_institution_registry",
          saveArgs(changed, { subdomain: "auth" }),
        ),
      );
      await ok(
        superadmin.rpc("import_institution_catalog", {
          items: [
            {
              ...rows.find((r) => r.subdomain === "fer"),
              name: "Must not overwrite manual name",
              official_website: "https://source.example",
            },
          ],
        }),
      );
      const after = await bySlug(newSlug);
      assert.equal(after.official_website, "https://manual.example");
      assert.equal(after.name, changed.name);
      const unizg = await bySlug("unizg");
      await denied(
        superadmin.rpc(
          "save_institution_registry",
          saveArgs(unizg, { parent_institution_id: fer.id }),
        ),
        "REGISTRY_PARENT_CYCLE",
      );
      await ok(
        superadmin.rpc(
          "save_institution_registry",
          saveArgs(after, { active: false }),
        ),
      );
      assert.equal((await request(H(newSlug), "/")).status, 404);
      const { full_domain, ...restore } = metadataBefore;
      await ok(service.from("institutions").update(restore).eq("id", fer.id));
      metadataBefore = undefined;
    },
  );
  if (process.env.WORKFLOW_PLAYWRIGHT_MODULE)
    await check(
      "Chromium searches 125 institutions, enters FER and verifies scoped login and administrator editing through localhost fallback",
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
        const local = "http://localhost:" + port;
        await page.goto(local);
        await page
          .getByRole("textbox", {
            name: "Pretraži ustanove po nazivu, gradu ili sveučilištu",
            exact: true,
          })
          .fill("elektrotehnike i računarstva");
        await page
          .getByRole("status")
          .filter({ hasText: "Prikazano 1 od 125" })
          .waitFor();
        await page
          .getByRole("link", { name: "Otvori profil ustanove", exact: true })
          .click();
        await page
          .getByRole("heading", { name: fer.name, exact: true })
          .waitFor();
        assert.equal(new URL(page.url()).hostname, "fer.localhost");
        await page.screenshot({
          path: "/tmp/isvu-tenant-fer.png",
          fullPage: true,
        });
        await page
          .getByRole("link", { name: "Prijava za ovu ustanovu", exact: true })
          .click();
        await page.goto(
          local + "/?module=auth&next=portal&institution=" + fer.id,
        );
        await page
          .getByLabel("E-adresa", { exact: true })
          .fill(users.student.email);
        await page
          .getByLabel("Lozinka", { exact: true })
          .fill(users.student.password);
        await page
          .getByRole("button", { name: "Prijavi se", exact: true })
          .click();
        await page.waitForURL(
          (u) =>
            u.hostname === "localhost" &&
            u.searchParams.get("module") === "portal" &&
            u.searchParams.get("institution") === fer.id,
        );
        await page.goto(local + "/?module=studomat&institution=" + fer.id);
        await page
          .getByRole("heading", { name: "Studomat", exact: true })
          .waitFor();
        await page.context().clearCookies();
        await page.goto(local + "/?module=auth");
        await page
          .getByLabel("E-adresa", { exact: true })
          .fill(users.superadmin.email);
        await page
          .getByLabel("Lozinka", { exact: true })
          .fill(users.superadmin.password);
        await page
          .getByRole("button", { name: "Prijavi se", exact: true })
          .click();
        await page.waitForURL(
          (u) =>
            u.hostname === "localhost" &&
            u.searchParams.get("module") === "portal",
        );
        await page.goto(local + "/?module=admin&view=Ustanove");
        await page
          .getByRole("textbox", {
            name: "Pretraži administraciju ustanova",
            exact: true,
          })
          .fill("Fakultet hrvatskih studija");
        await page
          .getByRole("button", { name: "Uredi metapodatke", exact: true })
          .click();
        await page
          .getByLabel("Poddomena (bez .isvu.me)", { exact: true })
          .waitFor();
        await page.screenshot({
          path: "/tmp/isvu-tenant-admin.png",
          fullPage: true,
        });
      },
    );
  console.log(`${count} institution tenant scenarios passed.`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill("SIGTERM");
  if (metadataBefore) {
    const { full_domain, ...restore } = metadataBefore;
    await ok(
      service.from("institutions").update(restore).eq("id", metadataBefore.id),
    );
  }
  if (enrollments.length)
    await ok(service.from("course_enrollments").delete().in("id", enrollments));
  if (studies.length)
    await ok(service.from("student_studies").delete().in("id", studies));
  if (courses.length)
    await ok(service.from("courses").delete().in("id", courses));
  if (semesters.length)
    await ok(service.from("semesters").delete().in("id", semesters));
  if (years.length)
    await ok(service.from("academic_years").delete().in("id", years));
  if (programs.length)
    await ok(service.from("study_programs").delete().in("id", programs));
  for (const m of addedMembers)
    await ok(service.from("memberships").delete().match(m));
}
