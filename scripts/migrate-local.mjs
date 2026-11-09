import { localConfig } from "./local-config.mjs";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
const config = localConfig();
if (!config.DB_CONTAINER)
  throw new Error(
    "Use supabase db reset for a full CLI profile; this helper is only for the lightweight test profile.",
  );
if (!["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname))
  throw new Error("Local migrations only");
function sql(text) {
  return execFileSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "-i",
      config.DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: text, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}
sql(
  "create table if not exists public.local_test_migrations(name text primary key); revoke all on public.local_test_migrations from public,anon,authenticated;",
);
// Existing phase-two test profile predates this runner. Detect its installed identity schema.
if (sql("select to_regclass('public.profiles') is not null").trim() === "t")
  sql(
    "insert into public.local_test_migrations values('202610300001_identity.sql') on conflict do nothing;",
  );
const applied = sql("select name from public.local_test_migrations")
  .trim()
  .split("\n");
for (const name of readdirSync("supabase/migrations")
  .filter((n) => /^\d+_[a-z0-9_]+\.sql$/.test(n))
  .sort()) {
  if (applied.includes(name)) continue;
  sql(
    "begin;\n" +
      readFileSync(`supabase/migrations/${name}`, "utf8") +
      `\ninsert into public.local_test_migrations values('${name}');\nnotify pgrst, 'reload schema';\ncommit;`,
  );
  console.log(`Applied ${name}`);
}
