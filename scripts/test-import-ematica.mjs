import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(c.API_URL).hostname));
const service = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const users = JSON.parse(readFileSync(".local-test-users.json")),
  fixtures = JSON.parse(readFileSync(".local-academic.json"));
const student = randomUUID(),
  candidateId = randomUUID(),
  choiceId = randomUUID(),
  sourceProgram = randomUUID(),
  sourceYear = randomUUID();
let sourceFailure = false,
  graduated = false,
  sourceReads = 0;
let candidateStatus = "ACCEPTED",
  active = false,
  sourceWrites = 0;
const source = http.createServer((req, res) => {
  if (req.method !== "GET") {
    sourceWrites++;
    res.writeHead(405);
    res.end();
    return;
  }
  sourceReads++;
  const url = new URL(req.url, "http://localhost");
  if (sourceFailure && url.pathname === "/rest/v1/schools") {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ code: "42501", message: "PRIVATE_SOURCE_DIAGNOSTIC" }),
    );
    return;
  }
  assert.ok(!url.search.includes("oib"));
  let data;
  switch (url.pathname) {
    case "/rest/v1/schools":
      data =
        url.searchParams.get("education_level") === "eq.SECONDARY"
          ? [{ id: "secondary", name: "Source secondary" }]
          : [{ id: "college", name: "Source college" }];
      break;
    case "/rest/v1/programs":
      data = [
        {
          id: sourceProgram,
          school_id: "college",
          name: "Source programme",
          schools: { name: "Source college", education_level: "HIGHER" },
        },
      ];
      break;
    case "/rest/v1/school_years":
      data = [{ id: sourceYear, label: "2026/2027" }];
      break;
    case "/rest/v1/admission_choices":
      data = [
        {
          id: choiceId,
          candidate_id: candidateId,
          target_school_id: "college",
          target_program_id: sourceProgram,
          is_accepted: true,
        },
      ];
      break;
    case "/rest/v1/admission_candidates":
      data = [
        {
          id: candidateId,
          registry_student_id: student,
          source_school_id: "secondary",
          school_year_id: sourceYear,
          accepted_choice_id: choiceId,
          status: candidateStatus,
          track: "HIGHER_EDUCATION",
          finalized_at: "2026-11-03T10:00:00Z",
          registry_students: {
            id: student,
            first_name: "Testni",
            last_name: "Prijenos",
          },
        },
      ];
      break;
    case "/rest/v1/student_school_enrollments":
      data =
        url.searchParams.get("status") === "eq.GRADUATED"
          ? []
          : active
            ? [
                {
                  id: randomUUID(),
                  student_id: student,
                  school_id: "college",
                  program_id: sourceProgram,
                  school_year_id: sourceYear,
                  status: "ACTIVE",
                },
              ]
            : [];
      break;
    case "/rest/v1/student_year_end_summaries":
      data =
        graduated && url.searchParams.has("school_id")
          ? [
              {
                id: randomUUID(),
                registry_student_id: student,
                school_id: "secondary",
                status: "GRADUATED",
                registry_students: {
                  id: student,
                  first_name: "Testni",
                  last_name: "Prijenos",
                },
              },
            ]
          : [];
      break;
    default:
      throw new Error("Unexpected source path");
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      req.headers.accept?.includes("vnd.pgrst.object") ? data[0] : data,
    ),
  );
});
source.listen(0, "127.0.0.1");
await once(source, "listening");
const port = Number(process.env.ADMISSION_TEST_PORT || 3007),
  host = `localhost:${port}`,
  sourceUrl = `http://127.0.0.1:${source.address().port}`;
const env = {
  ...process.env,
  EMATICA_SUPABASE_URL: sourceUrl,
  EMATICA_SUPABASE_SECRET_KEY: "local-source-only",
  SVS_SUPABASE_URL: c.API_URL,
  SVS_SUPABASE_SECRET_KEY: c.SERVICE_ROLE_KEY,
};
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    String(port),
    "--hostname",
    "0.0.0.0",
  ],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let serverErrors = "";
server.stderr.on("data", (chunk) => {
  serverErrors = (serverErrors + chunk.toString()).slice(-6000);
});
const request = (path, data, cookies = "", json = true) =>
  new Promise((resolve, reject) => {
    const body = data
      ? json
        ? JSON.stringify(data)
        : new URLSearchParams(data).toString()
      : "";
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: data ? "POST" : "GET",
        headers: {
          host,
          origin: `http://${host}`,
          cookie: cookies,
          ...(data
            ? {
                "content-type": json
                  ? "application/json"
                  : "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text,
            data: json && data ? JSON.parse(text) : null,
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
let mapping, userId, firstMapping, firstUser;
const temp = mkdtempSync(join(tmpdir(), "verified-import-"));
try {
  for (let i = 0; i < 80; i++) {
    try {
      await request("/");
      break;
    } catch {
      if (i === 79) throw Error("Test server not ready");
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const login = await request(
    "/api/auth/login",
    {
      email: users.superadmin.email,
      password: users.superadmin.password,
      next: "admin",
    },
    "",
    false,
  );
  assert.equal(login.status, 303);
  const cookies = (login.headers["set-cookie"] || [])
    .map((v) => v.split(";")[0])
    .join("; ");
  const call = (action, body) =>
    request(`/api/admissions/${action}`, body, cookies);
  const page = await request("/?module=admin&view=Uvoz%20upisa", null, cookies);
  if (page.status !== 200)
    console.log(serverErrors.replace(/https:\/\/[^\s]+/g, "[remote URL]"));
  assert.equal(page.status, 200);
  assert.ok(page.text.includes("Prvi upis učenika na fakultet"));
  const catalog = await call("catalog", {});
  assert.equal(catalog.status, 200);
  assert.equal(catalog.data.programs[0].id, sourceProgram);
  sourceFailure = true;
  const deniedSource = await call("catalog", {});
  assert.equal(deniedSource.status, 503);
  assert.ok(deniedSource.data.error.includes("EMATICA_SUPABASE_SECRET_KEY"));
  assert.ok(!deniedSource.text.includes("PRIVATE_SOURCE_DIAGNOSTIC"));
  sourceFailure = false;
  // First enrollment preparation must work even when the source has no faculty offer or is unavailable.
  sourceFailure = true;
  const before = sourceReads;
  assert.equal((await call("target-catalog", {})).status, 200);
  assert.equal(sourceReads, before);
  if (process.env.ADMISSION_PLAYWRIGHT_MODULE) {
    const {chromium}=await import(process.env.ADMISSION_PLAYWRIGHT_MODULE);
    const browser=await chromium.launch({executablePath:"/usr/bin/chromium",headless:true,args:["--no-sandbox"]});
    try {
      const page=await browser.newPage({viewport:{width:1440,height:1000}});
      await page.goto(`http://${host}/?module=auth&next=admin`);
      await page.locator('input[name="email"]').fill(users.superadmin.email);await page.locator('input[name="password"]').fill(users.superadmin.password);
      await Promise.all([page.waitForURL(/module=admin/),page.getByRole("button",{name:"Prijavi se",exact:true}).click()]);
      await page.goto(`http://${host}/?module=admin&view=Uvoz%20upisa`);
      await page.getByRole("heading",{name:"Prvi upis učenika na fakultet",exact:true}).waitFor();
      await page.getByRole("button",{name:"Učitaj učilišta i studije iz ISVU-a",exact:true}).click();
      await page.getByLabel("Učilište",{exact:true}).selectOption(fixtures.a);
      await page.getByLabel("Studijski program",{exact:true}).selectOption(fixtures.programA);
      await page.getByLabel("Akademska godina upisa",{exact:true}).selectOption(fixtures.yearA);
      await page.getByLabel("Domena novih korisničkih imena",{exact:true}).selectOption("example.test");
      await page.locator('input[name="requirements_reference"]').fill("Prvi upis - browser");
      assert.equal(await page.getByText("Izvorni fakultet / program",{exact:true}).count(),0);
      assert.equal(await page.locator('form').filter({has:page.locator('input[name="requirements_reference"]')}).evaluate(f=>f.checkValidity()),true);
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth),false);
      console.log("First-enrollment browser passed: target-first form available without a source faculty or functioning source catalogue; valid form and mobile width.");
    } finally {await browser.close();}
  }
  const firstSaved = await call("first-mapping", {
    institution_id: fixtures.a,
    program_id: fixtures.programA,
    academic_year_id: fixtures.yearA,
    domain: "example.test",
    matura_required: true,
    requirements_reference: "Prvi upis - test",
    enabled: true,
  });
  assert.equal(firstSaved.status, 200);
  firstMapping = firstSaved.data.id;
  assert.equal(sourceReads, before);
  const stored = await service
    .from("admission_import_mappings")
    .select("source_program_id,mode")
    .eq("id", firstMapping)
    .single();
  assert.equal(stored.data.source_program_id, null);
  assert.equal(stored.data.mode, "first");
  sourceFailure = false;
  candidateStatus = "DRAFT";
  active = false;
  const empty = await call("preview", { mapping_id: firstMapping });
  assert.equal(empty.status, 200);
  assert.equal(empty.data.rows.length, 0);
  const firstReview = {
    mapping_id: firstMapping,
    candidate_id: student,
    graduation_verified: false,
    matura_verified: true,
    conditions_verified: true,
    admission_approved: true,
    evidence_reference: "UPIS-TEST",
  };
  assert.equal((await call("review", firstReview)).status, 409);
  graduated = true;
  const firstPreview = await call("preview", { mapping_id: firstMapping });
  assert.equal(firstPreview.data.rows.length, 1);
  assert.equal(firstPreview.data.rows[0].eligible, false);
  assert.equal(
    (await call("review", { ...firstReview, admission_approved: false }))
      .status,
    200,
  );
  assert.equal(
    (await call("apply", { mapping_id: firstMapping, candidates: [student] }))
      .status,
    409,
  );
  assert.equal((await call("review", firstReview)).status, 200);
  const firstResult = await call("apply", {
    mapping_id: firstMapping,
    candidates: [student],
  });
  assert.equal(firstResult.status, 200);
  assert.equal(firstResult.data.results[0].status, "completed");
  firstUser = firstResult.data.results[0].user_id;
  assert.ok(firstResult.data.results[0].credentials.password);
  assert.equal(
    (
      await service
        .from("student_studies")
        .select("id")
        .eq("student_id", firstUser)
    ).data.length,
    1,
  );
  const again = await call("apply", {
    mapping_id: firstMapping,
    candidates: [student],
  });
  assert.equal(again.data.results[0].status, "already_completed");
  assert.ok(!again.data.results[0].credentials);
  // Clean first enrollment fixtures before testing the separate existing-enrollment workflow with the same source pupil.
  await service
    .from("admission_import_jobs")
    .delete()
    .eq("mapping_id", firstMapping);
  await service
    .from("admission_import_reviews")
    .delete()
    .eq("mapping_id", firstMapping);
  await service
    .from("admission_import_mappings")
    .delete()
    .eq("id", firstMapping);
  firstMapping = null;
  await service.from("student_studies").delete().eq("student_id", firstUser);
  await service.auth.admin.deleteUser(firstUser);
  firstUser = null;
  graduated = false;
  candidateStatus = "ACCEPTED";
  console.log(
    "First enrollment passed: target-only configuration without source reads, no source faculty/program, graduation gate, explicit first-admission approval, account/study creation and idempotent repeat.",
  );
  const saved = await call("mapping", {
    institution_id: fixtures.a,
    program_id: fixtures.programA,
    academic_year_id: fixtures.yearA,
    source_school_id: "college",
    source_program_id: sourceProgram,
    source_year_id: sourceYear,
    candidate_year_id: sourceYear,
    domain: "example.test",
    matura_required: true,
    requirements_reference: "Testni uvjeti upisa",
    enabled: true,
  });
  assert.equal(saved.status, 200);
  const row = await service
    .from("admission_import_mappings")
    .select("*")
    .eq("source_program_id", sourceProgram)
    .single();
  assert.ifError(row.error);
  mapping = row.data.id;
  if (process.env.ADMISSION_PLAYWRIGHT_MODULE) {
    const { chromium } = await import(process.env.ADMISSION_PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      await page.goto(`http://${host}/?module=auth&next=admin`);
      await page.locator('input[name="email"]').fill(users.superadmin.email);
      await page
        .locator('input[name="password"]')
        .fill(users.superadmin.password);
      await Promise.all([
        page.waitForURL(/module=admin/),
        page.getByRole("button", { name: "Prijavi se", exact: true }).click(),
      ]);
      await page.goto(`http://${host}/?module=admin&view=Uvoz%20upisa`);
      await page
        .getByRole("button", {
          name: "Preuzimanje već provedenih upisa",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Dohvati ponudu i mapiranja",
          exact: true,
        })
        .click();
      await page.getByLabel("Mapiranje", { exact: true }).selectOption(mapping);
      await page
        .getByRole("button", {
          name: "Provjeri upise bez spremanja",
          exact: true,
        })
        .click();
      await page.getByText("Potrebna provjera", { exact: false }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: /Preuzmi odabrane potvrđene upise/ })
          .isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "Uredi odabrano mapiranje", exact: true })
        .click();
      assert.equal(
        await page.locator('input[name="requirements_reference"]').inputValue(),
        "Testni uvjeti upisa",
      );
      assert.equal(
        await page.locator('select[name="source_year_id"]').inputValue(),
        sourceYear,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page
          .locator("body")
          .evaluate((el) => el.scrollWidth > window.innerWidth),
        false,
      );
      console.log(
        "Admissions browser passed: protected page, catalogue, mapping selection/edit, blocked candidate, disabled transfer and mobile width.",
      );
    } finally {
      await browser.close();
    }
  }
  const serviceClaim = await service.rpc("claim_admission_import", {
    mapping,
    candidate: randomUUID(),
  });
  assert.ifError(serviceClaim.error);
  assert.ok(serviceClaim.data);
  const preview = () => call("preview", { mapping_id: mapping });
  let p = await preview();
  assert.equal(p.status, 200);
  assert.equal(p.data.rows.length, 1);
  assert.equal(p.data.rows[0].eligible, false);
  let apply = await call("apply", {
    mapping_id: mapping,
    candidates: [candidateId],
  });
  assert.equal(apply.status, 409);
  active = true;
  p = await preview();
  assert.equal(p.data.rows[0].eligible, false);
  const review = await call("review", {
    mapping_id: mapping,
    candidate_id: candidateId,
    graduation_verified: true,
    matura_verified: true,
    conditions_verified: true,
    evidence_reference: "TEST-DOCUMENT-1",
  });
  assert.equal(review.status, 200);
  const stamped = await service
    .from("admission_import_reviews")
    .select("reviewed_by")
    .eq("mapping_id", mapping)
    .single();
  assert.equal(stamped.data.reviewed_by, users.superadmin.id);
  p = await preview();
  assert.equal(p.data.rows[0].eligible, true);
  const revised = await call("mapping", {
    ...row.data,
    id: mapping,
    requirements_reference: "Testni uvjeti - nova odluka",
  });
  assert.equal(revised.status, 200);
  p = await preview();
  assert.equal(p.data.rows[0].eligible, false);
  assert.equal(
    (await call("apply", { mapping_id: mapping, candidates: [candidateId] }))
      .status,
    409,
  );
  const recheck = await call("review", {
    mapping_id: mapping,
    candidate_id: candidateId,
    graduation_verified: true,
    matura_verified: true,
    conditions_verified: true,
    evidence_reference: "TEST-DOCUMENT-2",
  });
  assert.equal(recheck.status, 200);
  p = await preview();
  assert.equal(p.data.rows[0].eligible, true);
  // Every apply rechecks source state, even after a successful preview.
  candidateStatus = "WITHDRAWN";
  assert.equal(
    (await call("apply", { mapping_id: mapping, candidates: [candidateId] }))
      .status,
    409,
  );
  candidateStatus = "ACCEPTED";
  const parallel = await Promise.all([
    call("apply", { mapping_id: mapping, candidates: [candidateId] }),
    call("apply", { mapping_id: mapping, candidates: [candidateId] }),
  ]);
  assert.equal(parallel[0].status, 200);
  assert.equal(parallel[1].status, 200);
  const results = parallel.flatMap((r) => r.data.results),
    issued = results.filter((r) => r.credentials);
  assert.equal(issued.length, 1);
  const result = issued[0];
  userId = result.user_id;
  assert.ok(userId);
  assert.equal(parallel[0].headers["cache-control"], "private, no-store");
  const auth = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert.ifError(
    (
      await auth.auth.signInWithPassword({
        email: result.credentials.email,
        password: result.credentials.password,
      })
    ).error,
  );
  assert.equal(
    (await auth.auth.getUser()).data.user.app_metadata
      .svs_password_change_required,
    true,
  );
  assert.equal((await auth.rpc("session_is_active")).data, false);
  const password = randomBytes(24).toString("base64url");
  assert.ifError((await auth.auth.updateUser({ password })).error);
  const repeated = await call("apply", {
    mapping_id: mapping,
    candidates: [candidateId],
  });
  assert.equal(repeated.data.results[0].status, "already_completed");
  assert.ok(!repeated.data.results[0].credentials);
  assert.ifError(
    (
      await auth.auth.signInWithPassword({
        email: result.credentials.email,
        password,
      })
    ).error,
  );
  assert.equal(
    (
      await service
        .from("student_studies")
        .select("id")
        .eq("student_id", userId)
    ).data.length,
    1,
  );
  assert.equal(
    (await request("/api/admissions/preview", { mapping_id: mapping })).status,
    403,
  );
  const ordinary = await request(
    "/api/auth/login",
    { email: users.admin.email, password: users.admin.password, next: "isvu" },
    "",
    false,
  );
  const ordinaryCookie = (ordinary.headers["set-cookie"] || [])
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.equal(
    (await request("/api/admissions/catalog", {}, ordinaryCookie)).status,
    403,
  );
  const actor = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert.ifError(
    (
      await actor.auth.signInWithPassword({
        email: users.admin.email,
        password: users.admin.password,
      })
    ).error,
  );
  assert.ok(
    (
      await actor.rpc("claim_admission_import", {
        mapping,
        candidate: candidateId,
      })
    ).error,
  );
  assert.equal(
    (
      await call("mapping", {
        ...row.data,
        id: mapping,
        source_year_id: randomUUID(),
      })
    ).status,
    400,
  );
  const cli = await promisify(execFile)(
    process.execPath,
    ["scripts/import-ematica.mjs", "--mapping", mapping],
    { env },
  );
  assert.match(cli.stdout, /već dovršeno 1/);
  const output = join(temp, "repeat.jsonl");
  await promisify(execFile)(
    process.execPath,
    [
      "scripts/import-ematica.mjs",
      "--mapping",
      mapping,
      "--apply",
      "--credentials",
      output,
    ],
    { env },
  );
  assert.equal(readFileSync(output, "utf8"), "");
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      ["scripts/import-ematica.mjs", "--config", "old.json"],
      { env },
    ),
    /Stari ACTIVE-only/,
  );
  assert.equal(sourceWrites, 0);
  console.log(
    "Verified admissions passed: mapping, preview without writes, performed enrollment, evidence review, changed source rejection, parallel claim, initial credentials, forced password change, idempotent repeat, CLI gate, permissions and read-only source.",
  );
} finally {
  if (firstMapping) {
    await service
      .from("admission_import_jobs")
      .delete()
      .eq("mapping_id", firstMapping);
    await service
      .from("admission_import_reviews")
      .delete()
      .eq("mapping_id", firstMapping);
    await service
      .from("admission_import_mappings")
      .delete()
      .eq("id", firstMapping);
  }
  if (firstUser) {
    await service.from("student_studies").delete().eq("student_id", firstUser);
    await service.auth.admin.deleteUser(firstUser);
  }
  if (mapping) {
    await service
      .from("admission_import_jobs")
      .delete()
      .eq("mapping_id", mapping);
    await service
      .from("admission_import_reviews")
      .delete()
      .eq("mapping_id", mapping);
    await service.from("admission_import_mappings").delete().eq("id", mapping);
  }
  if (userId) {
    await service.from("student_studies").delete().eq("student_id", userId);
    await service.auth.admin.deleteUser(userId);
  }
  server.kill("SIGTERM");
  source.close();
  rmSync(temp, { recursive: true, force: true });
}
