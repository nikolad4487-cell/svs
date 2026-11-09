// Optional official Storage service for the lightweight local test profile.
// Credential files remain private; this script never prints their values.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const docker = (...args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
const env = Object.fromEntries(
  readFileSync(".local-svs-test-auth.env", "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
const password = new URL(env.GOTRUE_DB_DATABASE_URL).password;
const secret = env.GOTRUE_JWT_SECRET;
if (!password || !secret) throw new Error("Local Auth profile is required.");
const jwt = (role) => {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      role,
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 31536000,
    }),
  ).toString("base64url");
  const data = `${head}.${payload}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
};
const name = "svs-test-storage",
  image = "ghcr.io/supabase/storage-api:v1.28.0";
let exists = false;
try {
  docker("inspect", "--format", "{{.Name}}", name);
  exists = true;
} catch {}
if (exists) {
  const current = JSON.parse(
    docker("inspect", "--format", "{{json .Config.Env}}", name),
  );
  if (!current.includes("FILE_SIZE_LIMIT=1073741824")) {
    // Recreate only this test service; its database and named data volume remain.
    docker("stop", name);
    docker("rm", name);
    exists = false;
  }
}
if (exists) {
  docker(
    "exec",
    "svs-test-db",
    "psql",
    "-U",
    "postgres",
    "-c",
    "grant create on database postgres to supabase_storage_admin;",
  );
  docker("start", name);
} else {
  try {
    docker("image", "inspect", "--format", "{{.Id}}", image);
  } catch {
    docker("pull", image);
  }
  // The official service migrates its own Storage schema.
  const sql = `do $$ begin if not exists(select 1 from pg_roles where rolname='supabase_storage_admin') then create role supabase_storage_admin login bypassrls; end if; end $$;
    alter role supabase_storage_admin password '${password.replaceAll("'", "''")}';
    grant anon,authenticated,service_role to supabase_storage_admin;
    create schema if not exists storage authorization supabase_storage_admin;
    grant usage,create on schema public to supabase_storage_admin;
    grant create on database postgres to supabase_storage_admin;
    grant usage on schema auth to supabase_storage_admin;
    grant execute on all functions in schema auth to supabase_storage_admin;
    create or replace function auth.role() returns text language sql stable as 'select auth.jwt()->>''role''';
    grant execute on function auth.role() to anon,authenticated,service_role,supabase_storage_admin;`;
  execFileSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "-i",
      "svs-test-db",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, stdio: ["pipe", "pipe", "pipe"] },
  );
  const vars = {
    ANON_KEY: jwt("anon"),
    SERVICE_KEY: jwt("service_role"),
    PGRST_JWT_SECRET: secret,
    DATABASE_URL: `postgres://supabase_storage_admin:${password}@svs-test-db:5432/postgres`,
    DB_INSTALL_ROLES: "false",
    DATABASE_SEARCH_PATH: "storage",
    POSTGREST_URL: "http://svs-test-rest:3000",
    STORAGE_BACKEND: "file",
    FILE_STORAGE_BACKEND_PATH: "/var/lib/storage",
    FILE_SIZE_LIMIT: "1073741824",
    TENANT_ID: "local",
    REGION: "local",
    GLOBAL_S3_BUCKET: "local",
    ENABLE_IMAGE_TRANSFORMATION: "false",
  };
  writeFileSync(
    ".local-storage.env",
    Object.entries(vars)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
    { mode: 0o600 },
  );
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "svs-test-network",
    "-p",
    "127.0.0.1:54327:5000",
    "--env-file",
    ".local-storage.env",
    "--mount",
    "type=volume,source=svs-test-storage-data,target=/var/lib/storage",
    image,
  );
}
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch("http://127.0.0.1:54327/status")).ok) {
      // These grants are normally supplied by the full Supabase platform.
      docker(
        "exec",
        "svs-test-db",
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "grant usage on schema storage to anon,authenticated,service_role; grant select,insert,update,delete on storage.objects,storage.buckets to anon,authenticated,service_role;",
      );
      console.log("Official local Storage service ready.");
      process.exit(0);
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
throw new Error(
  "Local Storage did not become ready. Inspect its container without exposing environment credentials.",
);
