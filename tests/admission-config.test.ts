import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceConfiguration } from "../src/lib/admissions/config";
import {
  allRows,
  AdmissionReadError,
} from "../scripts/lib/verified-admissions.mjs";
test("missing Vercel variables are named without disclosing credentials", () => {
  assert.throws(
    () => sourceConfiguration({}),
    (e) =>
      e instanceof Error &&
      e.message.includes("EMATICA_SUPABASE_URL") &&
      e.message.includes("EMATICA_SUPABASE_SECRET_KEY") &&
      e.message.includes("Redeploy"),
  );
  assert.throws(
    () =>
      sourceConfiguration({
        EMATICA_SUPABASE_URL: "https://source.supabase.co",
      }),
    /EMATICA_SUPABASE_SECRET_KEY/,
  );
  for (const url of [
    "not-a-url",
    "http://source.supabase.co",
    "https://secret:password@source.supabase.co",
  ])
    assert.throws(
      () =>
        sourceConfiguration({
          EMATICA_SUPABASE_URL: url,
          EMATICA_SUPABASE_SECRET_KEY: "not-real",
        }),
      (e) =>
        e instanceof Error &&
        !e.message.includes("password") &&
        e.message.includes("HTTPS"),
    );
  assert.equal(
    sourceConfiguration({
      EMATICA_SUPABASE_URL: "https://source.supabase.co/",
      EMATICA_SUPABASE_SECRET_KEY: "not-real",
    }).origin,
    "https://source.supabase.co",
  );
});
test("read diagnostics distinguish source credentials and target schema without forwarding raw errors", async () => {
  const query = (code: string, status: number) => () => ({
    range: async () => ({
      error: { code, message: "PRIVATE_KEY_OR_PERSONAL_DATA" },
      status,
    }),
  });
  await assert.rejects(
    allRows(query("42501", 403), "e-Matica: visoka učilišta"),
    (e) =>
      e instanceof AdmissionReadError &&
      e.message.includes("EMATICA_SUPABASE_SECRET_KEY") &&
      !e.message.includes("PRIVATE_KEY"),
  );
  await assert.rejects(
    allRows(query("PGRST205", 404), "SVS: mapiranja", "target"),
    (e) =>
      e instanceof AdmissionReadError &&
      e.message.includes("202611030001_verified_admissions.sql") &&
      !e.message.includes("PRIVATE_KEY"),
  );
  await assert.rejects(
    allRows(query("42703", 400), "e-Matica: godine"),
    (e) =>
      e instanceof AdmissionReadError &&
      e.message.includes("shemi e-Matice") &&
      !e.message.includes("verified_admissions.sql"),
  );
});
