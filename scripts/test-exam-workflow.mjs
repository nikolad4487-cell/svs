import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const c = localConfig();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(c.API_URL).hostname));
const users = JSON.parse(readFileSync(".local-test-users.json"));
const f = JSON.parse(readFileSync(".local-academic.json"));
const service = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const db = {};
for (const role of ["student", "student2", "admin", "referada", "nastavnik"]) {
  const client = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert.ifError((await client.auth.signInWithPassword(users[role])).error);
  db[role] = client;
}
let count = 0,
  course,
  exam,
  enrollment,
  assignment,
  server;
const check = async (label, run) => {
  await run();
  console.log(`PASS ${label}`);
  count++;
};
const success = async (q) => {
  const r = await q;
  assert.ifError(r.error);
  return r.data;
};
const denied = async (q) => {
  const r = await q;
  assert.ok(r.error, "Expected operation to be rejected");
  return r.error;
};
const transition = (
  actor,
  from,
  to,
  reason = "Kontrola sintetskog ispitnog postupka",
) =>
  db[actor].rpc("transition_exam", {
    target: exam,
    expected_status: from,
    next_status: to,
    reason,
  });
const port = 3008,
  origin = `http://localhost:${port}`;
const request = async (path, fields, cookie = "") =>
  fetch(`${origin}${path}`, {
    method: fields ? "POST" : "GET",
    redirect: "manual",
    headers: {
      origin,
      cookie,
      ...(fields
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
  });
try {
  course = (
    await success(
      service
        .from("courses")
        .insert({
          institution_id: f.a,
          program_id: f.programA,
          semester_id: f.semesterA,
          name: "Sintetski ispitni postupak",
          code: `EX-${randomUUID().slice(0, 8)}`,
          ects: 5,
        })
        .select("id")
        .single(),
    )
  ).id;
  assignment = (
    await success(
      service
        .from("course_teachers")
        .insert({
          institution_id: f.a,
          course_id: course,
          teacher_id: users.nastavnik.id,
        })
        .select("id")
        .single(),
    )
  ).id;
  enrollment = (
    await success(
      service
        .from("course_enrollments")
        .insert({
          institution_id: f.a,
          study_id: f.studyA,
          course_id: course,
          student_id: users.student.id,
        })
        .select("id")
        .single(),
    )
  ).id;
  const future = new Date(Date.now() + 86400000).toISOString();
  const data = await success(
    db.admin
      .from("exams")
      .insert({
        institution_id: f.a,
        course_id: course,
        room_id: f.roomA,
        starts_at: future,
        registration_deadline: future,
        withdrawal_deadline: future,
        capacity: 10,
      })
      .select("*")
      .single(),
  );
  exam = data.id;
  await check(
    "new exam starts as draft; direct lifecycle writes are denied",
    async () => {
      assert.equal(data.workflow_status, "draft");
      assert.equal(data.legacy_workflow, false);
      assert.deepEqual(
        await success(db.student.from("exams").select("id").eq("id", exam)),
        [],
      );
      await denied(db.student.rpc("register_exam", { target: exam }));
      await denied(
        db.admin
          .from("exams")
          .update({ workflow_status: "locked" })
          .eq("id", exam),
      );
      await denied(
        db.admin
          .from("exams")
          .insert({ ...data, id: randomUUID(), workflow_status: "locked" }),
      );
    },
  );
  await check(
    "students and other institutions cannot operate the workflow",
    async () => {
      await denied(transition("student", "draft", "open"));
      await denied(transition("student2", "draft", "open"));
      assert.deepEqual(
        await success(db.student2.from("exams").select("id").eq("id", exam)),
        [],
      );
    },
  );
  await check(
    "reason and optimistic state checks reject stale or malformed transitions",
    async () => {
      await denied(transition("admin", "draft", "open", "x"));
      await denied(transition("admin", "open", "registration_closed"));
      await denied(transition("admin", "draft", "grading"));
      await success(transition("nastavnik", "draft", "open"));
    },
  );
  await check(
    "open registration succeeds; closure and future start are enforced",
    async () => {
      await success(db.student.rpc("register_exam", { target: exam }));
      await success(transition("nastavnik", "open", "registration_closed"));
      await denied(db.student.rpc("register_exam", { target: exam }));
      await denied(transition("admin", "registration_closed", "in_progress"));
      await denied(
        db.nastavnik.rpc("record_grade", {
          target: exam,
          student: users.student.id,
          result: 5,
        }),
      );
    },
  );
  const past = new Date(Date.now() - 3600000).toISOString();
  await success(
    service
      .from("exams")
      .update({
        starts_at: past,
        registration_deadline: past,
        withdrawal_deadline: past,
      })
      .eq("id", exam),
  );
  await success(transition("nastavnik", "registration_closed", "in_progress"));
  await success(transition("nastavnik", "in_progress", "grading"));
  await check(
    "unprocessed active registrations prevent locking; absence is a distinct non-grade",
    async () => {
      await denied(transition("nastavnik", "grading", "locked"));
      await success(
        db.nastavnik.rpc("record_exam_absence", {
          target: exam,
          student: users.student.id,
          note: "Nije pristupio ispitu",
        }),
      );
      const result = await success(
        db.student
          .from("grades")
          .select("grade,outcome")
          .eq("exam_id", exam)
          .single(),
      );
      assert.equal(result.grade, null);
      assert.equal(result.outcome, "absent");
    },
  );
  await check(
    "concurrent transitions produce exactly one lock event",
    async () => {
      const r = await Promise.all([
        transition("nastavnik", "grading", "locked"),
        transition("admin", "grading", "locked"),
      ]);
      assert.equal(r.filter((x) => !x.error).length, 1);
      assert.equal(r.filter((x) => x.error).length, 1);
    },
  );
  await check(
    "locked grades, term details, registration and deletion reject all ordinary writes",
    async () => {
      await denied(
        db.nastavnik.rpc("record_grade", {
          target: exam,
          student: users.student.id,
          result: 5,
        }),
      );
      await denied(
        service
          .from("grades")
          .update({ grade: 5, outcome: "graded" })
          .eq("exam_id", exam),
      );
      await denied(service.from("grades").delete().eq("exam_id", exam));
      await denied(
        db.admin.from("exams").update({ capacity: 11 }).eq("id", exam),
      );
      await denied(db.admin.from("exams").delete().eq("id", exam));
      await denied(
        db.student.rpc("register_exam", { target: exam, cancel: true }),
      );
      await denied(transition("nastavnik", "locked", "grading"));
    },
  );
  await check(
    "only institution staff can read reasons or unlock with a reason",
    async () => {
      assert.deepEqual(
        await success(
          db.student
            .from("exam_workflow_events")
            .select("*")
            .eq("exam_id", exam),
        ),
        [],
      );
      assert.deepEqual(
        await success(
          db.student2
            .from("exam_workflow_events")
            .select("*")
            .eq("exam_id", exam),
        ),
        [],
      );
      await denied(
        db.admin.from("exam_workflow_events").insert({
          institution_id: f.a,
          exam_id: exam,
          actor_id: users.admin.id,
          previous_status: "locked",
          next_status: "grading",
          reason: "Krivotvoreni zapis",
        }),
      );
      await denied(transition("referada", "locked", "grading", ""));
      await success(
        transition(
          "referada",
          "locked",
          "grading",
          "Ispravak pogrešno evidentiranog nedolaska",
        ),
      );
      await success(
        db.nastavnik.rpc("record_grade", {
          target: exam,
          student: users.student.id,
          result: 4,
        }),
      );
      assert.equal(
        (
          await success(
            db.student
              .from("grades")
              .select("outcome,grade")
              .eq("exam_id", exam)
              .single(),
          )
        ).grade,
        4,
      );
      await success(
        transition(
          "referada",
          "grading",
          "locked",
          "Zaključavanje nakon provjerenog ispravka",
        ),
      );
      const events = await success(
        db.admin.from("exam_workflow_events").select("*").eq("exam_id", exam),
      );
      const history = await success(
        db.student
          .from("exam_grade_events")
          .select("*")
          .eq("exam_id", exam)
          .order("occurred_at"),
      );
      assert.equal(history.length, 2);
      assert.equal(history[0].next_outcome, "absent");
      assert.equal(history[1].previous_outcome, "absent");
      assert.equal(history[1].next_grade, 4);
      assert.deepEqual(
        await success(
          db.student2.from("exam_grade_events").select("*").eq("exam_id", exam),
        ),
        [],
      );
      await denied(
        db.admin.from("exam_grade_events").delete().eq("exam_id", exam),
      );
      assert.equal(events.length, 7);
      assert.ok(
        events.some(
          (e) =>
            e.previous_status === "locked" && e.actor_id === users.referada.id,
        ),
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
        NEXT_PUBLIC_SUPABASE_URL: c.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: c.ANON_KEY,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await request("/");
      if (r.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "Local Next server not ready");
  const cookies = {};
  for (const role of ["student", "admin", "nastavnik"]) {
    const r = await request("/api/auth/login", {
      email: users[role].email,
      password: users[role].password,
      next: "studomat",
    });
    assert.equal(r.status, 303);
    cookies[role] = r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }
  await check(
    "web forms render correct state, absence choice and audit; API enforces authorization",
    async () => {
      const admin = await request(
        `/?module=isvu&view=${encodeURIComponent("Ispitni rokovi")}&institution=${f.a}`,
        null,
        cookies.admin,
      );
      assert.equal(admin.status, 200);
      const html = await admin.text();
      assert.ok(html.includes("Otključaj za ispravak"));
      assert.ok(html.includes("Povijest postupka"));
      const grading = await request(
        `/?module=studomat&view=Ocjenjivanje&institution=${f.a}`,
        null,
        cookies.nastavnik,
      );
      assert.equal(grading.status, 200);
      assert.ok((await grading.text()).includes("Zaključano"));
      const fields = {
        institution_id: f.a,
        exam_id: exam,
        expected_status: "locked",
        next_status: "grading",
        reason: "Ispravak kroz web obrazac",
        return_module: "isvu",
        return_view: "Ispitni rokovi",
      };
      assert.equal(
        (await request("/api/academic/exam-state", fields, cookies.student))
          .status,
        303,
      );
      assert.equal(
        (
          await success(
            db.admin
              .from("exams")
              .select("workflow_status")
              .eq("id", exam)
              .single(),
          )
        ).workflow_status,
        "locked",
      );
      const unlocked = await request(
        "/api/academic/exam-state",
        fields,
        cookies.admin,
      );
      assert.equal(unlocked.status, 303);
      assert.ok(unlocked.headers.get("location").includes("status=saved"));
      const stale = await request(
        "/api/academic/exam-state",
        fields,
        cookies.admin,
      );
      assert.ok(stale.headers.get("location").includes("status=exam-stale"));
      const edit = await request(
        `/?module=studomat&view=Ocjenjivanje&institution=${f.a}`,
        null,
        cookies.nastavnik,
      );
      assert.ok((await edit.text()).includes('value="absent"'));
    },
  );
  console.log(
    `${count} exam workflow integration scenarios passed against local Auth, PostgREST, PostgreSQL and Next.js.`,
  );
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      if (server.exitCode !== null) resolve();
      else server.once("exit", resolve);
    });
  }
  if (exam) {
    const current = await service
      .from("exams")
      .select("workflow_status")
      .eq("id", exam)
      .single();
    if (current.data?.workflow_status === "locked")
      await success(
        transition(
          "admin",
          "locked",
          "grading",
          "Otključavanje isključivo sintetskog testnog roka",
        ),
      );
    await success(service.from("grades").delete().eq("exam_id", exam));
    await success(
      service.from("exam_grade_events").delete().eq("exam_id", exam),
    );
    await success(
      service.from("exam_registrations").delete().eq("exam_id", exam),
    );
    await success(
      service.from("exam_workflow_events").delete().eq("exam_id", exam),
    );
    await success(service.from("exams").delete().eq("id", exam));
  }
  for (const [table, id] of [
    ["course_enrollments", enrollment],
    ["course_teachers", assignment],
    ["courses", course],
  ])
    if (id) await success(service.from(table).delete().eq("id", id));
}
