import { localConfig } from "./local-config.mjs";
// Real local Supabase + running Next server. Does not print credentials.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import http from "node:http";
const env = localConfig();
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(env.API_URL).hostname),
  "Local tests only",
);
const users = JSON.parse(readFileSync(".local-test-users.json", "utf8"));
const client = () =>
  createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
let checks = 0;
async function check(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}
const student = client(),
  admin = client(),
  superadmin = client();
for (const [db, key] of [
  [student, "student"],
  [admin, "admin"],
  [superadmin, "superadmin"],
]) {
  const result = await db.auth.signInWithPassword({
    email: users[key].email,
    password: users[key].password,
  });
  assert.ifError(result.error);
}
await check("institution domains are editable only by authorized administrators", async () => {
  const allowed = await admin.from("institutions").update({ email_domains: ["example.test"] }).eq("id", a).select();
  assert.ifError(allowed.error);
  assert.equal(allowed.data.length, 1);
  for (const [db, id] of [[student, a], [admin, b]]) {
    const denied = await db.from("institutions").update({ email_domains: ["evil.example"] }).eq("id", id).select();
    assert.ok(denied.error || denied.data.length === 0);
  }
  const invalid = await admin.from("institutions").update({ email_domains: ["*.example.test"] }).eq("id", a);
  assert.ok(invalid.error);
  const invite = await admin.from("registration_invites").insert({ institution_id: a, email: "blocked@other.example", role: "student", created_by: users.admin.id });
  assert.ok(invite.error);
});
await check(
  "students see their institution only, including ID tampering",
  async () => {
    const all = await student.from("institutions").select("*");
    assert.ifError(all.error);
    assert.deepEqual(
      all.data.map((i) => i.id),
      [a],
    );
    const other = await student.from("institutions").select("*").eq("id", b);
    assert.deepEqual(other.data, []);
  },
);
await check("student cannot read another profile", async () => {
  const result = await student
    .from("profiles")
    .select("*")
    .eq("id", users.student2.id);
  assert.deepEqual(result.data, []);
});
await check("student cannot grant own role or become superadmin", async () => {
  const result = await student
    .from("memberships")
    .insert({
      user_id: users.student.id,
      institution_id: b,
      role: "institution_admin",
    });
  assert.ok(result.error);
  const elevated = await student
    .from("superadmins")
    .insert({ user_id: users.student.id });
  assert.ok(elevated.error);
  assert.equal((await student.rpc("is_superadmin")).data, false);
});
await check(
  "institution administrator cannot modify another institution or assign administrator roles",
  async () => {
    const other = await admin
      .from("institutions")
      .update({ name: "Unauthorized" })
      .eq("id", b)
      .select();
    assert.deepEqual(other.data, []);
    const invite = await admin
      .from("registration_invites")
      .insert({
        institution_id: a,
        email: "blocked@example.test",
        role: "institution_admin",
        created_by: users.admin.id,
      });
    assert.ok(invite.error);
  },
);
await check("superadministrator can manage institutions", async () => {
  const result = await superadmin.from("institutions").select("*");
  assert.ifError(result.error);
  assert.ok(result.data.some((i) => i.id === b));
  const updated = await superadmin
    .from("institutions")
    .update({ headquarters: "Split" })
    .eq("id", b)
    .select();
  assert.ifError(updated.error);
  assert.equal(updated.data.length, 1);
});
await check(
  "one account can hold different roles at different institutions",
  async () => {
    const add = await superadmin
      .from("memberships")
      .upsert({
        user_id: users.nastavnik.id,
        institution_id: b,
        role: "student",
      });
    assert.ifError(add.error);
    const teacher = client();
    assert.ifError(
      (
        await teacher.auth.signInWithPassword({
          email: users.nastavnik.email,
          password: users.nastavnik.password,
        })
      ).error,
    );
    const result = await teacher.from("memberships").select("*");
    assert.ifError(result.error);
    assert.ok(
      result.data.some((m) => m.institution_id === a && m.role === "teacher"),
    );
    assert.ok(
      result.data.some((m) => m.institution_id === b && m.role === "student"),
    );
    assert.ifError(
      (
        await superadmin
          .from("memberships")
          .delete()
          .match({
            user_id: users.nastavnik.id,
            institution_id: b,
            role: "student",
          })
      ).error,
    );
  },
);
await check("Auth hook rejects direct uninvited registration", async () => {
  const result = await client().auth.signUp({
    email: `not-invited-${Date.now()}@example.test`,
    password: randomBytes(20).toString("hex"),
  });
  assert.ok(result.error, "Auth hook must reject direct API calls");
});
await check(
  "invited signup requires confirmation before role activation",
  async () => {
    const email = `invited-${Date.now()}@example.test`;
    const password = randomBytes(20).toString("hex");
    assert.ifError(
      (
        await admin
          .from("registration_invites")
          .insert({
            institution_id: a,
            email,
            role: "student",
            created_by: users.admin.id,
          })
      ).error,
    );
    const fresh = client();
    const signup = await fresh.auth.signUp({ email, password });
    assert.ifError(signup.error);
    assert.ok(signup.data.user);
    assert.equal(signup.data.session, null);
    const before = await service
      .from("memberships")
      .select("*")
      .eq("user_id", signup.data.user.id);
    assert.equal(before.data.length, 0);
    assert.ifError(
      (
        await service.auth.admin.updateUserById(signup.data.user.id, {
          email_confirm: true,
        })
      ).error,
    );
    assert.ifError(
      (await fresh.auth.signInWithPassword({ email, password })).error,
    );
    const after = await fresh.from("memberships").select("*");
    assert.equal(after.data.length, 1);
    assert.equal(after.data[0].role, "student");
    assert.ifError(
      (await service.auth.admin.deleteUser(signup.data.user.id)).error,
    );
    assert.ifError(
      (await service.from("registration_invites").delete().eq("email", email))
        .error,
    );
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
        res.on("data", (d) => (text += d));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: text }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}
const authHost = `auth.svs.test:${port}`,
  portalHost = `portal.svs.test:${port}`,
  adminHost = `admin.svs.test:${port}`;
let cookies = "";
await check(
  "unauthenticated protected module redirects to central login",
  async () => {
    const result = await request(portalHost);
    assert.equal(result.status, 307);
    assert.ok(result.headers.location.startsWith(`http://${authHost}/`));
    assert.ok(result.headers.location.includes("next=portal"));
  },
);
await check("CSRF denies foreign origin and missing Origin", async () => {
  for (const origin of ["https://evil.test", undefined]) {
    const result = await request(authHost, "/api/auth/login", {
      method: "POST",
      origin,
      data: { email: users.student.email, password: users.student.password },
    });
    assert.equal(result.status, 403);
  }
});
await check(
  "real login sets HttpOnly parent-domain cookie and safe redirect",
  async () => {
    const result = await request(authHost, "/api/auth/login", {
      method: "POST",
      origin: `http://${authHost}`,
      data: {
        email: users.student.email,
        password: users.student.password,
        next: "https://evil.test",
      },
    });
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, `http://${portalHost}/`);
    const set = result.headers["set-cookie"] || [];
    assert.ok(set.length > 0);
    assert.ok(
      set.some(
        (c) =>
          /HttpOnly/i.test(c) &&
          /Domain=.svs.test/i.test(c) &&
          /SameSite=lax/i.test(c),
      ),
    );
    cookies = set.map((c) => c.split(";")[0]).join("; ");
  },
);
await check(
  "one session crosses portal, studomat, LMS and timetable subdomains",
  async () => {
    for (const module of ["portal", "studomat", "merlin", "raspored"]) {
      const result = await request(`${module}.svs.test:${port}`, "/", {
        cookies,
      });
      assert.equal(result.status, 200);
      assert.ok(!result.body.includes("Povežite Supabase"));
      assert.ok(result.body.includes("Moj račun"));
    }
  },
);
await check(
  "server denies student admin pages and privileged mutations",
  async () => {
    const result = await request(adminHost, "/", { cookies });
    assert.ok(result.body.includes("Pristup nije dopušten"));
    assert.ok(!result.body.includes("Dodaj visoko učilište"));
    const mutation = await request(adminHost, "/api/admin/institution", {
      method: "POST",
      origin: `http://${adminHost}`,
      cookies,
      data: {
        name: "Unauthorized",
        code: "HACK",
        headquarters: "",
        contact_email: "",
      },
    });
    assert.equal(mutation.status, 403);
  },
);

await check("active session listing and selective revocation", async () => {
  const other = client();
  assert.ifError(
    (
      await other.auth.signInWithPassword({
        email: users.student.email,
        password: users.student.password,
      })
    ).error,
  );
  const listed = await other.rpc("list_my_sessions");
  assert.ifError(listed.error);
  const current = listed.data.find((s) => s.current_session);
  assert.ok(current);
  const mine = await student.rpc("list_my_sessions");
  assert.ifError(mine.error);
  assert.ok(mine.data.some((s) => s.id === current.id));
  assert.ifError(
    (await student.rpc("revoke_my_session", { target: current.id })).error,
  );
  assert.equal((await other.rpc("session_is_active")).data, false);
  assert.equal((await student.rpc("session_is_active")).data, true);
});
await check(
  "localhost fallback keeps a host-only session across module links",
  async () => {
    const host = `localhost:${port}`;
    const result = await request(host, "/api/auth/login", {
      method: "POST",
      origin: `http://${host}`,
      data: {
        email: users.student.email,
        password: users.student.password,
        next: "studomat",
      },
    });
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, `http://${host}/?module=studomat`);
    const set = result.headers["set-cookie"] || [];
    assert.ok(set.length > 0);
    assert.ok(set.every((c) => !c.toLowerCase().includes("domain=")));
    const localCookies = set.map((c) => c.split(";")[0]).join("; ");
    const page = await request(host, "/?module=portal", {
      cookies: localCookies,
    });
    assert.equal(page.status, 200);
    assert.ok(page.body.includes("Moj račun"));
  },
);
await check(
  "password recovery verifies single-use email token and revokes old sessions",
  async () => {
    const link = await service.auth.admin.generateLink({
      type: "recovery",
      email: users.student2.email,
    });
    assert.ifError(link.error);
    const token = link.data.properties.hashed_token;
    const verified = await request(
      authHost,
      `/api/auth/confirm?type=recovery&token_hash=${encodeURIComponent(token)}`,
    );
    assert.equal(verified.status, 303);
    assert.ok(verified.headers.location.includes("mode=password"));
    const resetCookies = (verified.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    assert.ok(resetCookies);
    const newPassword = randomBytes(24).toString("hex");
    try {
      const updated = await request(authHost, "/api/auth/password", {
        method: "POST",
        origin: `http://${authHost}`,
        cookies: resetCookies,
        data: { password: newPassword },
      });
      assert.equal(updated.status, 303);
      assert.ok(updated.headers.location.includes("password-changed"));
      const fresh = client();
      assert.ifError(
        (
          await fresh.auth.signInWithPassword({
            email: users.student2.email,
            password: newPassword,
          })
        ).error,
      );
      const replay = await request(
        authHost,
        `/api/auth/confirm?type=recovery&token_hash=${encodeURIComponent(token)}`,
      );
      assert.ok(replay.headers.location.includes("expired"));
    } finally {
      assert.ifError(
        (
          await service.auth.admin.updateUserById(users.student2.id, {
            password: users.student2.password,
          })
        ).error,
      );
    }
  },
);
await check(
  "superadministrator can create an institution using the guarded HTTP form",
  async () => {
    const login = await request(authHost, "/api/auth/login", {
      method: "POST",
      origin: `http://${authHost}`,
      data: {
        email: users.superadmin.email,
        password: users.superadmin.password,
        next: "admin",
      },
    });
    assert.equal(login.status, 303);
    const adminCookies = (login.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    const code = `HTTP-${Date.now()}`;
    try {
      const result = await request(adminHost, "/api/admin/institution", {
        method: "POST",
        origin: `http://${adminHost}`,
        cookies: adminCookies,
        data: {
          name: "HTTP test ustanova",
          email_domains: "Faculty.Example, students.faculty.example",
          code,
          headquarters: "Zagreb",
          contact_email: "",
        },
      });
      assert.equal(result.status, 303);
      assert.ok(result.headers.location.includes("status=saved"));
      assert.equal(
        (await superadmin.from("institutions").select("id").eq("code", code))
          .data.length,
        1,
      );
      const saved = await superadmin.from("institutions").select("email_domains").eq("code", code).single();
      assert.ifError(saved.error);
      assert.deepEqual(saved.data.email_domains, ["faculty.example", "students.faculty.example"]);
      const page = await request(adminHost, "/", { cookies: adminCookies });
      assert.ok(page.body.includes("Dodaj visoko učilište"));
    } finally {
      const row = await service
        .from("institutions")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (row.data) {
        await service
          .from("audit_logs")
          .delete()
          .eq("institution_id", row.data.id);
        assert.ifError(
          (await service.from("institutions").delete().eq("id", row.data.id))
            .error,
        );
      }
    }
  },
);
await check(
  "global logout clears session and prevents reused-cookie access",
  async () => {
    const result = await request(authHost, "/api/auth/logout", {
      method: "POST",
      origin: `http://${authHost}`,
      cookies,
      data: { scope: "global" },
    });
    assert.equal(result.status, 303);
    assert.ok(result.headers.location.includes("signed-out"));
    const replay = await request(portalHost, "/", { cookies });
    assert.equal(replay.status, 307);
    const revoked = await student.from("institutions").select("*");
    assert.ok(revoked.error || revoked.data.length === 0);
  },
);
console.log(
  `${checks} stvarnih Supabase/HTTP integracijskih scenarija prošlo.`,
);
