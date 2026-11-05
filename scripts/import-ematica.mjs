// Reviewed admissions only. The former ACTIVE-only import path is intentionally removed.
import { createClient } from "@supabase/supabase-js";
import {
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  realpathSync,
} from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  admissionPreview,
  provisionAdmission,
} from "./lib/verified-admissions.mjs";
const args = process.argv.slice(2),
  arg = (name) => args[args.indexOf(name) + 1];
for (const key of [
  "EMATICA_SUPABASE_URL",
  "EMATICA_SUPABASE_SECRET_KEY",
  "SVS_SUPABASE_URL",
  "SVS_SUPABASE_SECRET_KEY",
])
  if (!process.env[key]) throw new Error(`Nedostaje ${key}.`);
if (!args.includes("--mapping"))
  throw new Error(
    "Najprije spremite mapiranje i provjere u Administracija sustava → Uvoz upisa, zatim koristite --mapping UUID. Stari ACTIVE-only --config uvoz više nije dopušten.",
  );
const id = z.uuid().parse(arg("--mapping")),
  sourceUrl = new URL(process.env.EMATICA_SUPABASE_URL),
  targetUrl = new URL(process.env.SVS_SUPABASE_URL);
for (const u of [sourceUrl, targetUrl])
  if (
    u.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(u.hostname)
  )
    throw new Error("Udaljeni projekti zahtijevaju HTTPS.");
if (sourceUrl.origin === targetUrl.origin)
  throw new Error("Izvorni i ciljni projekt moraju biti zasebni.");
const options = { auth: { persistSession: false, autoRefreshToken: false } },
  source = createClient(
    sourceUrl.origin,
    process.env.EMATICA_SUPABASE_SECRET_KEY,
    options,
  ),
  target = createClient(
    targetUrl.origin,
    process.env.SVS_SUPABASE_SECRET_KEY,
    options,
  );
const m = await target
  .from("admission_import_mappings")
  .select("*")
  .eq("id", id)
  .single();
if (m.error)
  throw new Error(
    "Mapiranje nije dostupno. Primijenite migraciju 202611030001_verified_admissions.sql.",
  );
const institution = await target
  .from("institutions")
  .select("name")
  .eq("id", m.data.institution_id)
  .single();
if (institution.error) throw new Error("Ustanova nije dostupna.");
const ready = await target.rpc("password_change_session_is_active");
if (ready.error) throw new Error("Nedostaje migracija za privremene lozinke.");
const rows = await admissionPreview(source, target, m.data);
const eligible = rows.filter(
  (r) => r.eligible && r.job !== "completed" && r.job !== "running",
);
console.log(
  `Pregled: ${rows.length} kandidata; spremno ${eligible.length}; blokirano ${rows.filter((r) => !r.eligible).length}; već dovršeno ${rows.filter((r) => r.job === "completed").length}.`,
);
if (!args.includes("--apply")) {
  console.log(
    "Pregled bez spremanja. Za prijenos koristite --apply --credentials /sigurna/putanja/novi-racuni.jsonl.",
  );
  process.exit(0);
}
if (!args.includes("--credentials"))
  throw new Error("Potrebna je nova izlazna datoteka pristupnih podataka.");
const path = resolve(arg("--credentials")),
  root = realpathSync(fileURLToPath(new URL("../", import.meta.url))),
  relation = relative(root, realpathSync(dirname(path)));
if (!relation || (!relation.startsWith("../") && relation !== ".."))
  throw new Error("Datoteka lozinki mora biti izvan repozitorija.");
const output = openSync(path, "wx", 0o600);
let completed = 0,
  failed = 0;
try {
  for (const row of eligible) {
    try {
      await provisionAdmission(
        target,
        target,
        m.data,
        row,
        sourceUrl.origin,
        institution.data.name,
        (record) => {
          writeSync(output, JSON.stringify(record) + "\n");
          fsyncSync(output);
        },
      );
      completed++;
    } catch {
      failed++;
    }
  }
} finally {
  closeSync(output);
}
console.log(
  `Prijenos: dovršeno ${completed}; neuspjelo ${failed}. Lozinke postojećih računa nisu mijenjane. Sačuvajte izlaznu datoteku i pregledajte stanje prije ponavljanja.`,
);
if (failed) process.exitCode = 1;
