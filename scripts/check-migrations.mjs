import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { localConfig } from "./local-config.mjs";
const config = localConfig();
if (!config.DB_CONTAINER)
  throw new Error("Lightweight local test profile required");
const docker = [
  "--host=unix:///var/run/docker.sock",
  "exec",
  "-i",
  config.DB_CONTAINER,
];
const name = "svs_phase3_schema_check";
function sql(database, text) {
  return execFileSync(
    "docker",
    [
      ...docker,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: text, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}
if (sql("postgres", `select 1 from pg_database where datname='${name}'`).trim())
  throw new Error("Existing check database preserved.");
sql("postgres", `create database ${name}`);
try {
  // Real Auth schema from the official service, without application triggers that refer to public functions.
  const auth = execFileSync(
    "docker",
    [
      ...docker,
      "pg_dump",
      "-U",
      "postgres",
      "--schema-only",
      "--schema=auth",
      "postgres",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).replace(
    /^CREATE TRIGGER (?:on_auth_user_sync|import_password_changed)[^\n]*\n/gm,
    "",
  );
  sql(name, auth);
  // Real Storage schema, excluding application policies recreated by the installer.
  const storage = execFileSync(
    "docker",
    [
      ...docker,
      "pg_dump",
      "-U",
      "postgres",
      "--schema-only",
      "--schema=storage",
      "postgres",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).replace(/^CREATE POLICY (?:merlin_object_|issp_photo_)[\s\S]*?;\n/gm, "");
  sql(name, storage);
  sql(name, readFileSync("supabase/setup.sql", "utf8"));
  const tables = Number(
    sql(
      name,
      "select count(*) from pg_tables where schemaname='public' and rowsecurity",
    ),
  );
  if (tables !== 47) throw new Error(`Expected 47 RLS tables, got ${tables}`);
  console.log(
    "Fresh SQL installer verified on PostgreSQL with real Auth and Storage schemas; all 47 application tables have RLS.",
  );
} finally {
  sql("postgres", `drop database ${name}`);
}
