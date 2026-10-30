// Lightweight local TEST profile: official Auth and PostgREST, Alpine PostgreSQL.
// This is not a full Supabase CLI stack and is never a production deployment.
import { execFileSync, spawn } from "node:child_process";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  openSync,
  chmodSync,
} from "node:fs";
import { randomBytes, createHmac } from "node:crypto";
const docker = (...args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
const names = [
  "svs-test-db",
  "svs-test-auth",
  "svs-test-rest",
  "svs-test-mail",
];
if (process.argv.includes("--stop")) {
  for (const name of names) {
    try {
      docker("stop", name);
    } catch {}
  }
  console.log("Local test containers stopped; data retained.");
  process.exit(0);
}
const existing = names.filter((n) => {
  try {
    docker("container", "inspect", "--format", "{{.Name}}", n);
    return true;
  } catch {
    return false;
  }
});
if (existing.length === names.length && existsSync(".local-supabase.json")) {
  for (const name of names) docker("start", name);
  await wait(async () => (await fetch("http://127.0.0.1:54325/health")).ok);
  let gateway = false;
  try {
    gateway = (await fetch("http://127.0.0.1:54321/auth/v1/health")).ok;
  } catch {}
  if (!gateway) {
    const log = openSync("/tmp/svs-local-gateway.log", "a");
    spawn(process.execPath, ["scripts/local-gateway.mjs"], {
      detached: true,
      stdio: ["ignore", log, log],
    }).unref();
  }
  await wait(
    async () => (await fetch("http://127.0.0.1:54321/auth/v1/health")).ok,
  );
  console.log("Existing local test profile resumed; data preserved.");
  process.exit(0);
}
if (existing.length || existsSync(".local-supabase.json"))
  throw new Error(
    "Partial local test profile preserved. Inspect it before manual recovery; no data has been deleted.",
  );
const secret = randomBytes(48).toString("hex"),
  dbpass = randomBytes(24).toString("hex");
function jwt(role) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      role,
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    }),
  ).toString("base64url");
  const body = `${header}.${claims}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
function envfile(name, vars) {
  const path = `.local-${name}.env`;
  writeFileSync(
    path,
    Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  chmodSync(path, 0o600);
  return path;
}
try {
  docker("network", "inspect", "svs-test-network");
} catch {
  docker("network", "create", "svs-test-network");
}
for (const image of [
  "postgres:17-alpine",
  "ghcr.io/supabase/gotrue:v2.197.0",
  "ghcr.io/supabase/postgrest:v16.5",
  "ghcr.io/supabase/mailpit:v1.31.3",
]) {
  console.log(`Preparing ${image}`);
  try {
    docker("image", "inspect", "--format", "{{.Id}}", image);
  } catch {
    docker("pull", image);
  }
}
const run = (name, image, ports, env) =>
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "svs-test-network",
    ...ports.flatMap((p) => ["-p", `127.0.0.1:${p}`]),
    "--env-file",
    envfile(name, env),
    image,
  );
run(names[0], "postgres:17-alpine", ["54322:5432"], {
  POSTGRES_PASSWORD: dbpass,
  POSTGRES_DB: "postgres",
});
async function wait(fn) {
  for (let i = 0; i < 100; i++) {
    try {
      if (await fn()) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Local service readiness timed out");
}
await wait(() => {
  docker("exec", names[0], "pg_isready", "-h", "127.0.0.1", "-U", "postgres");
  return true;
});
function sql(text) {
  execFileSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "-i",
      names[0],
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: text, stdio: ["pipe", "pipe", "pipe"] },
  );
}
sql(
  `create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator login password '${dbpass}' noinherit; grant anon,authenticated,service_role to authenticator; create role supabase_auth_admin login password '${dbpass}' createrole; create schema auth authorization supabase_auth_admin; alter role supabase_auth_admin set search_path=auth,public; grant usage on schema auth to anon,authenticated,service_role; alter default privileges in schema public grant all on tables to service_role; alter default privileges in schema public grant all on sequences to service_role; grant usage on schema public to service_role; `,
);

run(names[3], "ghcr.io/supabase/mailpit:v1.31.3", ["54324:8025"], {});
run(names[1], "ghcr.io/supabase/gotrue:v2.197.0", ["54325:9999"], {
  GOTRUE_API_HOST: "0.0.0.0",
  GOTRUE_API_PORT: "9999",
  API_EXTERNAL_URL: "http://127.0.0.1:54321/auth/v1",
  GOTRUE_DB_DRIVER: "postgres",
  GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${dbpass}@svs-test-db:5432/postgres?sslmode=disable`,
  GOTRUE_DB_NAMESPACE: "auth",
  GOTRUE_SITE_URL: "http://auth.svs.test:3002",
  GOTRUE_URI_ALLOW_LIST:
    "http://auth.svs.test:3002/api/auth/callback,http://auth.localhost:3002/api/auth/callback,http://localhost:3002/api/auth/callback",
  GOTRUE_JWT_SECRET: secret,
  GOTRUE_JWT_EXP: "3600",
  GOTRUE_JWT_ADMIN_ROLES: "service_role",
  GOTRUE_JWT_AUD: "authenticated",
  GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
  GOTRUE_DISABLE_SIGNUP: "false",
  GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
  GOTRUE_MAILER_AUTOCONFIRM: "false",
  GOTRUE_PASSWORD_MIN_LENGTH: "12",
  GOTRUE_SMTP_HOST: names[3],
  GOTRUE_SMTP_PORT: "1025",
  GOTRUE_SMTP_ADMIN_EMAIL: "noreply@example.test",
  GOTRUE_SMTP_SENDER_NAME: "SVS local test",
  GOTRUE_RATE_LIMIT_EMAIL_SENT: "100",
  GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS: "1000",
  GOTRUE_HOOK_BEFORE_USER_CREATED_ENABLED: "true",
  GOTRUE_HOOK_BEFORE_USER_CREATED_URI:
    "pg-functions://postgres/public/before_user_created",
});
await wait(async () => (await fetch("http://127.0.0.1:54325/health")).ok);
sql(
  `create or replace function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$; create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;`,
);
for (const migration of readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort())
  sql(readFileSync(`supabase/migrations/${migration}`, "utf8"));
sql(
  "create table public.local_test_migrations(name text primary key); revoke all on public.local_test_migrations from public,anon,authenticated;",
);
for (const migration of readdirSync("supabase/migrations").filter((n) =>
  n.endsWith(".sql"),
))
  sql(`insert into public.local_test_migrations values('${migration}');`);
sql(readFileSync("supabase/seed.sql", "utf8"));
run(names[2], "ghcr.io/supabase/postgrest:v16.5", ["54326:3000"], {
  PGRST_DB_URI: `postgres://authenticator:${dbpass}@svs-test-db:5432/postgres`,
  PGRST_DB_SCHEMAS: "public",
  PGRST_DB_ANON_ROLE: "anon",
  PGRST_JWT_SECRET: secret,
});
await wait(async () => (await fetch("http://127.0.0.1:54326/")).ok);
writeFileSync(
  ".local-supabase.json",
  JSON.stringify({
    API_URL: "http://127.0.0.1:54321",
    ANON_KEY: jwt("anon"),
    SERVICE_ROLE_KEY: jwt("service_role"),
    DB_CONTAINER: names[0],
  }),
  { mode: 0o600 },
);
chmodSync(".local-supabase.json", 0o600);
const log = openSync("/tmp/svs-local-gateway.log", "a");
spawn(process.execPath, ["scripts/local-gateway.mjs"], {
  detached: true,
  stdio: ["ignore", log, log],
}).unref();
await wait(
  async () => (await fetch("http://127.0.0.1:54321/auth/v1/health")).ok,
);
console.log(
  "Lightweight local Auth/PostgreSQL/PostgREST test profile ready. No credentials printed.",
);
