import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import http from "node:http";
import { localConfig } from "./local-config.mjs";
const env = localConfig();
assert.ok(["127.0.0.1", "localhost"].includes(new URL(env.API_URL).hostname));
const users = JSON.parse(readFileSync(".local-test-users.json", "utf8"));
const f = JSON.parse(readFileSync(".local-academic.json", "utf8"));
const create = () =>
  createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const db = {};
for (const role of ["student", "student2", "admin", "referada", "nastavnik"]) {
  db[role] = create();
  assert.ifError(
    (
      await db[role].auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      })
    ).error,
  );
}
let count = 0;
async function check(label, run) {
  await run();
  console.log(`PASS ${label}`);
  count++;
}
await check(
  "student sees own study/enrolment and cannot read other institution IDs",
  async () => {
    for (const [table, id] of [
      ["courses", f.courseB],
      ["student_studies", f.studyB],
      ["exams", f.examB],
    ]) {
      const r = await db.student.from(table).select("*").eq("id", id);
      assert.ifError(r.error);
      assert.deepEqual(r.data, []);
    }
    assert.equal(
      (await db.student.from("student_studies").select("*")).data.length,
      1,
    );
  },
);
await check(
  "student cannot modify academic records or write grades directly",
  async () => {
    const r = await db.student
      .from("courses")
      .update({ name: "Hacked" })
      .eq("id", f.courseA)
      .select();
    assert.ok(r.error || r.data.length === 0);
    assert.ok(
      (
        await db.student
          .from("grades")
          .insert({
            institution_id: f.a,
            exam_id: f.pastExam,
            student_id: users.student.id,
            grade: 5,
            graded_by: users.student.id,
          })
      ).error,
    );
    assert.ok(
      (
        await db.student.rpc("record_grade", {
          target: f.pastExam,
          student: users.student.id,
          result: 5,
        })
      ).error,
    );
  },
);
await check(
  "composite foreign keys reject cross-institution academic links",
  async () => {
    const r = await db.admin
      .from("courses")
      .insert({
        institution_id: f.a,
        program_id: f.programB,
        semester_id: f.semesterA,
        name: "Invalid linkage",
        code: `BAD-${Date.now()}`,
        ects: 5,
      });
    assert.ok(r.error);
  },
);
await check(
  "registrar can manage own institution but not another",
  async () => {
    const good = await db.referada
      .from("study_programs")
      .update({ name: "Računarstvo" })
      .eq("id", f.programA)
      .select();
    assert.ifError(good.error);
    assert.equal(good.data.length, 1);
    const bad = await db.referada
      .from("study_programs")
      .update({ name: "Hacked" })
      .eq("id", f.programB)
      .select();
    assert.ok(bad.error || bad.data.length === 0);
  },
);
await check(
  "teacher is limited to assigned course and its students",
  async () => {
    assert.ok(
      (
        await db.nastavnik.rpc("record_grade", {
          target: f.examB,
          student: users.student2.id,
          result: 5,
        })
      ).error,
    );
    const roster = await db.nastavnik.from("course_enrollments").select("*");
    assert.ifError(roster.error);
    assert.ok(roster.data.every((e) => e.course_id === f.courseA));
    const profile = await db.nastavnik
      .from("profiles")
      .select("*")
      .eq("id", users.student2.id);
    assert.deepEqual(profile.data, []);
  },
);
// Remove only earlier test grade of this known local fixture to exercise registration anew.
assert.ifError(
  (
    await service
      .from("grades")
      .delete()
      .eq("exam_id", f.pastExam)
      .eq("student_id", users.student.id)
  ).error,
);
await check(
  "student registers once, cancels and can register again",
  async () => {
    assert.ifError(
      (await db.student.rpc("register_exam", { target: f.examA })).error,
    );
    assert.ifError(
      (await db.student.rpc("register_exam", { target: f.examA })).error,
    );
    let rows = await db.student
      .from("exam_registrations")
      .select("*")
      .eq("exam_id", f.examA);
    assert.equal(rows.data.length, 1);
    assert.equal(rows.data[0].status, "registered");
    assert.ifError(
      (await db.student.rpc("register_exam", { target: f.examA, cancel: true }))
        .error,
    );
    assert.equal(
      (
        await db.student
          .from("exam_registrations")
          .select("status")
          .eq("exam_id", f.examA)
          .single()
      ).data.status,
      "cancelled",
    );
    assert.ifError(
      (await db.student.rpc("register_exam", { target: f.examA })).error,
    );
  },
);
await check(
  "expired deadlines and unowned exams fail even via direct RPC",
  async () => {
    assert.ok(
      (await db.student.rpc("register_exam", { target: f.pastExam })).error,
    );
    assert.ok(
      (await db.student.rpc("register_exam", { target: f.examB })).error,
    );
    assert.ok(
      (
        await db.student
          .from("exam_registrations")
          .insert({
            institution_id: f.b,
            exam_id: f.examB,
            student_id: users.student.id,
          })
      ).error,
    );
  },
);
await check(
  "teacher grades only held exams and valid registrations",
  async () => {
    assert.ok(
      (
        await db.nastavnik.rpc("record_grade", {
          target: f.examA,
          student: users.student.id,
          result: 5,
        })
      ).error,
    );
    assert.ifError(
      (
        await db.nastavnik.rpc("record_grade", {
          target: f.pastExam,
          student: users.student.id,
          result: 4,
          note: "Uspješno riješen ispit.",
        })
      ).error,
    );
    const own = await db.student
      .from("grades")
      .select("*")
      .eq("exam_id", f.pastExam);
    assert.ifError(own.error);
    assert.equal(own.data[0].grade, 4);
    assert.equal(
      (await db.student2.from("grades").select("*").eq("exam_id", f.pastExam))
        .data.length,
      0,
    );
    assert.ok(
      (
        await db.student.rpc("register_exam", {
          target: f.pastExam,
          cancel: true,
        })
      ).error,
    );
  },
);
await check("historical ECTS cannot change after enrolment", async () => {
  assert.ok(
    (await db.admin.from("courses").update({ ects: 30 }).eq("id", f.courseA))
      .error,
  );
});
await check(
  "timetable prevents overlapping rooms and assigned teachers",
  async () => {
    const original = (
      await db.admin
        .from("schedule_entries")
        .select("*")
        .eq("id", f.schedule)
        .single()
    ).data;
    const { id, ...copy } = original;
    assert.ok((await db.admin.from("schedule_entries").insert(copy)).error);
    assert.ok((await db.student.from("schedule_entries").insert(copy)).error);
  },
);
await check(
  "exam capacity is serialized across concurrent registrations",
  async () => {
    const examId = randomUUID(),
      studyId = randomUUID(),
      enrollmentId = randomUUID();
    try {
      assert.ifError(
        (
          await service
            .from("memberships")
            .upsert({
              institution_id: f.a,
              user_id: users.student2.id,
              role: "student",
            })
        ).error,
      );
      assert.ifError(
        (
          await service
            .from("student_studies")
            .insert({
              id: studyId,
              institution_id: f.a,
              student_id: users.student2.id,
              program_id: f.programA,
              academic_year_id: f.yearA,
              study_year: 1,
              student_number: "CAPACITY-TEST",
              status: "active",
            })
        ).error,
      );
      assert.ifError(
        (
          await service
            .from("course_enrollments")
            .insert({
              id: enrollmentId,
              institution_id: f.a,
              study_id: studyId,
              course_id: f.courseA,
              student_id: users.student2.id,
            })
        ).error,
      );
      const original = (
        await service.from("exams").select("*").eq("id", f.examA).single()
      ).data;
      assert.ifError(
        (
          await service
            .from("exams")
            .insert({ ...original, id: examId, capacity: 1 })
        ).error,
      );
      // Both are enrolled; ignore earlier passing grade for this fixture only, then restore it.
      assert.ifError(
        (
          await service
            .from("grades")
            .delete()
            .eq("exam_id", f.pastExam)
            .eq("student_id", users.student.id)
        ).error,
      );
      const results = await Promise.all([
        db.student.rpc("register_exam", { target: examId }),
        db.student2.rpc("register_exam", { target: examId }),
      ]);
      assert.equal(results.filter((r) => !r.error).length, 1);
      assert.equal(
        (
          await service
            .from("exam_registrations")
            .select("*")
            .eq("exam_id", examId)
            .eq("status", "registered")
        ).data.length,
        1,
      );
    } finally {
      await service.from("exam_registrations").delete().eq("exam_id", examId);
      await service.from("exams").delete().eq("id", examId);
      await service.from("course_enrollments").delete().eq("id", enrollmentId);
      await service.from("student_studies").delete().eq("id", studyId);
      await service
        .from("memberships")
        .delete()
        .match({
          institution_id: f.a,
          user_id: users.student2.id,
          role: "student",
        });
      assert.ifError(
        (
          await db.nastavnik.rpc("record_grade", {
            target: f.pastExam,
            student: users.student.id,
            result: 4,
            note: "Uspješno riješen ispit.",
          })
        ).error,
      );
    }
  },
);

await check(
  "student can read own course teacher name but not unrelated student profiles",
  async () => {
    const result = await db.student
      .from("profiles")
      .select("full_name")
      .eq("id", users.nastavnik.id)
      .single();
    assert.ifError(result.error);
    assert.equal(result.data.full_name, "Test nastavnik");
    assert.equal(
      (
        await db.student
          .from("profiles")
          .select("id")
          .eq("id", users.student2.id)
      ).data.length,
      0,
    );
  },
);
await check(
  "concurrent timetable writes cannot double-book a teacher or room",
  async () => {
    const original = (
      await db.admin
        .from("schedule_entries")
        .select("*")
        .eq("id", f.schedule)
        .single()
    ).data;
    const first = randomUUID(),
      second = randomUUID();
    const time = new Date(Date.now() + 20 * 86400000);
    time.setUTCHours(10, 0, 0, 0);
    const payload = {
      ...original,
      starts_at: time.toISOString(),
      ends_at: new Date(time.getTime() + 3600000).toISOString(),
    };
    try {
      const results = await Promise.all([
        db.admin.from("schedule_entries").insert({ ...payload, id: first }),
        db.admin.from("schedule_entries").insert({ ...payload, id: second }),
      ]);
      assert.equal(results.filter((r) => !r.error).length, 1);
    } finally {
      await service.from("schedule_entries").delete().in("id", [first, second]);
    }
  },
);
const port = Number(process.env.AUTH_TEST_PORT || 3002);
function request(
  host,
  path = "/",
  { method = "GET", data = {}, cookies = "", origin } = {},
) {
  return new Promise((resolve, reject) => {
    const body = method === "POST" ? new URLSearchParams(data).toString() : "";
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          host,
          ...(cookies ? { cookie: cookies } : {}),
          ...(origin ? { origin } : {}),
          ...(method === "POST"
            ? {
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (text += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: text }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}
async function login(role) {
  const host = `auth.svs.test:${port}`;
  const r = await request(host, "/api/auth/login", {
    method: "POST",
    origin: `http://${host}`,
    data: { email: users[role].email, password: users[role].password },
  });
  assert.equal(r.status, 303);
  return (r.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
}
const studentCookie = await login("student"),
  teacherCookie = await login("nastavnik"),
  adminCookie = await login("admin");
await check(
  "real student portal displays database study, ECTS, courses and timetable",
  async () => {
    for (const [host, path, text] of [
      ["portal", "/", "Dobro došli, Test student"],
      ["studomat", "/?view=Kolegiji", "Uvod u programiranje"],
      ["studomat", "/?view=Ocjene", "Uspješno riješen ispit."],
      ["studomat", "/?view=ECTS%20bodovi", "Ostvareni ECTS bodovi"],
      ["raspored", "/?view=Kalendar", "Sljedeći mjesec"],
    ]) {
      const r = await request(`${host}.svs.test:${port}`, path, {
        cookies: studentCookie,
      });
      assert.equal(r.status, 200);
      assert.ok(
        r.body.replace(/<!--.*?-->/gs, "").includes(text),
        `${host}${path}`,
      );
      assert.ok(!r.body.includes("Osnove poslovanja"));
    }
  },
);
await check(
  "teacher can open grading but student cannot mutate academic staff data",
  async () => {
    const page = await request(
      `studomat.svs.test:${port}`,
      "/?view=Ocjenjivanje",
      { cookies: teacherCookie },
    );
    assert.ok(page.body.includes("Spremi ocjenu"));
    const host = `studomat.svs.test:${port}`;
    const result = await request(host, "/api/academic/program", {
      method: "POST",
      origin: `http://${host}`,
      cookies: studentCookie,
      data: {
        institution_id: f.a,
        name: "Hacked",
        code: "BAD",
        degree: "Stručni",
        duration_years: "3",
        return_module: "studomat",
      },
    });
    assert.equal(result.status, 403);
  },
);
await check(
  "institution administrator creates and edits a course using real HTTP forms",
  async () => {
    const host = `isvu.svs.test:${port}`;
    const code = `HTTP-${Date.now()}`;
    let courseId;
    try {
      const form = {
        institution_id: f.a,
        name: "HTTP funkcionalni kolegij",
        code,
        program_id: f.programA,
        semester_id: f.semesterA,
        ects: "5",
        return_module: "isvu",
        return_view: "Kolegiji",
      };
      const result = await request(host, "/api/academic/course", {
        method: "POST",
        origin: `http://${host}`,
        cookies: adminCookie,
        data: form,
      });
      assert.equal(result.status, 303);
      assert.ok(result.headers.location.includes("status=saved"));
      const course = await db.admin
        .from("courses")
        .select("*")
        .eq("code", code)
        .single();
      assert.ifError(course.error);
      courseId = course.data.id;
      const edited = await request(host, "/api/academic/course", {
        method: "POST",
        origin: `http://${host}`,
        cookies: adminCookie,
        data: { ...form, id: courseId, name: "Uređen funkcionalni kolegij" },
      });
      assert.ok(edited.headers.location.includes("status=saved"));
      assert.equal(
        (
          await db.admin
            .from("courses")
            .select("name")
            .eq("id", courseId)
            .single()
        ).data.name,
        "Uređen funkcionalni kolegij",
      );
      const page = await request(host, "/?view=Kolegiji", {
        cookies: adminCookie,
      });
      assert.ok(page.body.includes("Uređen funkcionalni kolegij"));
    } finally {
      if (courseId) await service.from("courses").delete().eq("id", courseId);
    }
  },
);
console.log(`${count} akademskih DB/HTTP integracijskih scenarija prošlo.`);
