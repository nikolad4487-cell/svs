import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(c.API_URL).hostname));
const users = JSON.parse(readFileSync(".local-test-users.json")),
  f = JSON.parse(readFileSync(".local-academic.json"));
const service = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const clients = {};
for (const role of ["student", "student2", "admin", "nastavnik"]) {
  const client = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert.ifError(
    (
      await client.auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      })
    ).error,
  );
  clients[role] = client;
}
const port = Number(process.env.AUTH_TEST_PORT || 3006),
  host = `localhost:${port}`;
const request = (path, data, cookies = "") =>
  new Promise((resolve, reject) => {
    const body = data ? new URLSearchParams(data).toString() : "";
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
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: text }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
const cookies = {};
for (const role of ["student", "admin"]) {
  const r = await request("/api/auth/login", {
    email: users[role].email,
    password: users[role].password,
    next: role === "admin" ? "isvu" : "studomat",
  });
  assert.equal(r.status, 303);
  cookies[role] = (r.headers["set-cookie"] || [])
    .map((c) => c.split(";")[0])
    .join("; ");
}
const year = await service
  .from("academic_years")
  .insert({
    institution_id: f.a,
    name: `ST-${randomUUID().slice(0, 8)}`,
    starts_on: "2037-10-01",
    ends_on: "2038-09-30",
  })
  .select("id")
  .single();
assert.ifError(year.error);
const y = year.data.id,
  ids = [];
try {
  const common = {
    institution_id: f.a,
    academic_year_id: y,
    student_id: users.student.id,
    return_module: "isvu",
    return_view: "Studentske evidencije",
  };
  const kinds = {
    dining: {
      level: "2.5",
      valid_from: "2037-10-01",
      valid_until: "2038-09-30",
    },
    extra_ects: {
      title: "Testna praksa",
      ects: "2.5",
      date: "2037-11-01",
      reference: `TEST-${randomUUID()}`,
    },
    tuition: {
      title: "Testna školarina",
      amount: "1000",
      paid: "300",
      due_on: "2037-11-01",
      reference: "",
    },
    participation: {
      basis: "Testna odluka",
      full_amount: "1000",
      ects_price: "20",
      unearned_ects: "30",
      correction_percent: "10",
      maximum: "500",
      note: "Test obračuna",
      date: "2037-11-01",
    },
    mobility: {
      institution: "Testno učilište",
      country: "Hrvatska",
      purpose: "Razmjena",
      starts_on: "2037-11-01",
      ends_on: "2038-01-01",
    },
    category: {
      category: "Testna kategorija",
      reference: "T-1",
      valid_from: "2037-10-01",
      valid_until: "2038-09-30",
    },
    attendance: {
      course_id: f.courseA,
      date: "2037-11-01",
      held_hours: "2",
      attended_hours: "1",
    },
    certificate: {
      title: "Testna potvrda",
      reference: "P-1",
      date: "2037-11-01",
      body: "Testni sadržaj potvrde",
    },
  };
  for (const [kind, payload] of Object.entries(kinds)) {
    const r = await request(
      "/api/student-services/save",
      { ...common, kind, ...payload },
      cookies.admin,
    );
    assert.equal(r.status, 303, kind);
    assert.ok(r.headers.location.includes("status=saved"), kind);
    const row = await service
      .from("student_services")
      .select("id")
      .eq("institution_id", f.a)
      .eq("academic_year_id", y)
      .eq("kind", kind)
      .single();
    assert.ifError(row.error);
    ids.push(row.data.id);
  }
  const own = await clients.student
    .from("student_services")
    .select("*")
    .eq("academic_year_id", y);
  assert.ifError(own.error);
  assert.equal(own.data.length, 8);
  for (const role of ["student2", "nastavnik"])
    assert.equal(
      (
        await clients[role]
          .from("student_services")
          .select("*")
          .eq("academic_year_id", y)
      ).data.length,
      0,
    );
  const tamper = await clients.student
    .from("student_services")
    .insert({
      institution_id: f.a,
      academic_year_id: y,
      student_id: users.student.id,
      kind: "extra_ects",
      payload: { ects: 999 },
    });
  assert.ok(tamper.error);
  const edit = await clients.student
    .from("student_services")
    .update({ payload: { level: "9" } })
    .eq("id", ids[0])
    .select("id");
  assert.ok(edit.error || edit.data.length === 0);
  const cross = await clients.admin
    .from("student_services")
    .insert({
      institution_id: f.a,
      academic_year_id: y,
      student_id: users.student2.id,
      kind: "category",
      payload: { category: "Bad" },
    });
  assert.ok(cross.error);
  assert.equal(
    (
      await request(
        "/api/student-services/save",
        { ...common, kind: "dining", ...kinds.dining },
        cookies.student,
      )
    ).status,
    403,
  );
  const personalKeys = [
    "residence_status",
    "health_insurance",
    "first_enrollment_year",
    "parallel_study",
    "scholarship",
    "permanent_address",
    "temporary_address",
    "supporter",
    "supporter_occupation",
    "supporter_employment",
    "mother_education",
    "mother_occupation",
    "mother_employment",
    "father_education",
    "father_occupation",
    "father_employment",
  ];
  const personal = Object.fromEntries(personalKeys.map((k) => [k, ""]));
  personal.residence_status = "Studentski dom";
  const saved = await request(
    "/api/student-services/personal",
    {
      institution_id: f.a,
      academic_year_id: y,
      return_view: "Osobni podaci",
      ...personal,
    },
    cookies.student,
  );
  assert.equal(saved.status, 303);
  assert.ok(saved.headers.location.includes("status=saved"));
  const pref = await request(
    "/api/student-services/preferences",
    {
      institution_id: f.a,
      academic_year_id: y,
      return_view: "E-mail opcije",
      contact_email: "student@example.test",
      exam_registration: "on",
    },
    cookies.student,
  );
  assert.equal(pref.status, 303);
  const report = await clients.student
    .from("student_reports")
    .select("*")
    .eq("academic_year_id", y)
    .single();
  assert.ifError(report.error);
  assert.equal(report.data.personal.residence_status, "Studentski dom");
  assert.equal(report.data.preferences.exam_registration, true);
  assert.equal(
    (
      await clients.student2
        .from("student_reports")
        .select("*")
        .eq("academic_year_id", y)
    ).data.length,
    0,
  );
  const comparison = await clients.student.rpc("student_cohort_summary", {
    inst: f.a,
    program: f.programA,
    year_id: f.yearA,
  });
  assert.ifError(comparison.error);
  assert.equal(comparison.data.available, false);
  const forbidden = await clients.student2.rpc("student_cohort_summary", {
    inst: f.a,
    program: f.programA,
    year_id: f.yearA,
  });
  assert.ok(forbidden.error);
  for (const view of [
    "Prijava ispita",
    "Odjava ispita",
    "Ispiti u tijeku",
    "Pregled ispitnih rokova",
    "Pregled ispita",
    "Osobni podaci",
    "E-mail opcije",
    "Moj račun ustanove",
    "Pregled podataka o studiranju",
    "Upisane godine i predmeti",
    "Aktivni predmeti",
    "Dodatni ECTS bodovi",
    "Pregled školarina",
    "Pregled izračunatih participacija",
    "Razina prava na prehranu",
    "Pregled boravaka",
    "Kategorija studenta",
    "Potvrde",
    "Upute",
    "Kontakt referade",
  ]) {
    const page = await request(
      `/?module=studomat&view=${encodeURIComponent(view)}&institution=${f.a}&academic_year=${y}`,
      null,
      cookies.student,
    );
    assert.equal(page.status, 200, view);
    const heading = view === "Osobni podaci" ? "Izmjena osobnih podataka" : view;
    assert.ok(page.body.includes(`>${heading}</h2>`), `Missing actual content heading: ${view}`);
    assert.ok(!page.body.includes("Something went wrong"), view);
    if (view === "Pregled školarina")
      assert.ok(page.body.includes("700,00"), view);
    if (view === "Pregled izračunatih participacija")
      assert.ok(page.body.includes("450,00"), view);
  }
  const detail = await request(
    `/?module=studomat&view=Aktivni%20predmeti&institution=${f.a}&course=${f.courseA}`,
    null,
    cookies.student,
  );
  assert.equal(detail.status, 200);
  assert.ok(detail.body.includes("Tjedni plan nastave"));
  const adminPage = await request(
    `/?module=isvu&view=Studentske%20evidencije&institution=${f.a}`,
    null,
    cookies.admin,
  );
  assert.equal(adminPage.status, 200);
  assert.ok(adminPage.body.includes("/api/student-services/save"));
  console.log(
    "Student services passed: 8 kinds via HTTP, annual personal data and preferences, 20 student views, course details, financial calculations, staff controls, student/teacher/cross-institution RLS and cohort authorization.",
  );
} finally {
  await service.from("student_services").delete().eq("academic_year_id", y);
  await service.from("student_reports").delete().eq("academic_year_id", y);
  assert.ifError(
    (await service.from("academic_years").delete().eq("id", y)).error,
  );
}
