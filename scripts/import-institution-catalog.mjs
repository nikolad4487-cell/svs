import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
const rows = JSON.parse(
    readFileSync("data/institutions/catalog-125.json", "utf8"),
  ),
  bindings = JSON.parse(
    readFileSync("data/institutions/legacy-bindings.json", "utf8"),
  );
if (
  rows.length !== 125 ||
  new Set(rows.map((r) => r.registry_key)).size !== 125 ||
  new Set(rows.map((r) => r.subdomain)).size !== 125
)
  throw Error("Invalid 125-institution catalog.");
const production = process.argv.includes("--production"),
  apply = process.argv.includes("--apply");
let url, key;
if (production) {
  url = process.env.SVS_SUPABASE_URL;
  key = process.env.SVS_SUPABASE_SECRET_KEY;
  if (
    !url ||
    new URL(url).origin !== "https://wjxmyxxwqspwswfwjpdn.supabase.co"
  )
    throw Error(
      "Production import is restricted to the configured ISVU project.",
    );
} else {
  const c = localConfig();
  url = c.API_URL;
  key = c.SERVICE_ROLE_KEY;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw Error("Local import requires a local test database.");
}
if (!key)
  throw Error(
    "Configured server credential is missing; do not paste it into chat.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(30000) }),
  },
});
const ready = await db
  .from("institutions")
  .select("id,registry_key,subdomain,registry_metadata_locked")
  .limit(1);
if (ready.error)
  throw Error(
    "Apply 202611110002_institution_tenants.sql in this ISVU project before importing.",
  );
console.log(
  JSON.stringify({
    environment: production ? "ISVU production" : "local test",
    operation: apply ? "apply" : "read-only preview",
    catalog_records: rows.length,
    unverified_websites: rows.filter(
      (r) => r.website_verification_status === "requires_verification",
    ).length,
    missing_websites: rows.filter((r) => !r.official_website).length,
    legacy_binding_keys: Object.keys(bindings),
  }),
);
if (!apply) {
  console.log(
    "No rows changed. Add --apply only after reviewing the catalog and mappings.",
  );
  process.exit(0);
}
const result = await db.rpc("import_institution_catalog", {
  items: rows,
  legacy_bindings: bindings,
});
if (result.error)
  throw Error(
    `Import failed (${result.error.code}); existing data was not partially imported.`,
  );
console.log(JSON.stringify(result.data));
