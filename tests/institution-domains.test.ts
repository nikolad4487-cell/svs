import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  asciiSlug,
  websiteLabel,
  allocateSubdomain,
  validSubdomain,
  officialWebsite,
} from "../src/lib/institutions/domains";
import { resolveHost } from "../src/lib/hosts";
import { institutionUrl } from "../src/lib/routes";
const rows = JSON.parse(
  readFileSync("data/institutions/catalog-125.json", "utf8"),
) as {
  registry_key: string;
  isvu_institution_id: string | null;
  name: string;
  parent_name: string | null;
  subdomain: string;
  official_website: string | null;
  website_verification_status: string;
  domain_verification_status: string;
}[];
test("catalog contains exactly 125 stable identities, unique nontechnical domains and separate equal names", () => {
  assert.equal(rows.length, 125);
  assert.equal(new Set(rows.map((r) => r.registry_key)).size, 125);
  assert.equal(new Set(rows.map((r) => r.subdomain)).size, 125);
  const ids = rows.flatMap((r) =>
    r.isvu_institution_id ? [r.isvu_institution_id] : [],
  );
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(rows.every((r) => validSubdomain(r.subdomain)));
  assert.equal(rows.filter((r) => r.name === "Ekonomski fakultet").length, 3);
  assert.equal(rows.filter((r) => r.name === "Filozofski fakultet").length, 4);
  assert.equal(
    new Set(
      rows
        .filter((r) => r.name === "Filozofski fakultet")
        .map((r) => r.parent_name),
    ).size,
    4,
  );
  for (const r of rows)
    if (!r.official_website)
      assert.equal(r.domain_verification_status, "requires_verification");
});
test("website-derived labels and collision handling obey the requested examples without fabricated verification", () => {
  for (const [web, label] of [
    ["www.fer.unizg.hr", "fer"],
    ["www.fhs.unizg.hr", "fhs"],
    ["www.foi.unizg.hr", "foi"],
    ["www.vuka.hr", "vuka"],
    ["www.unizg.hr", "unizg"],
    ["www.uniri.hr", "uniri"],
    ["www.efzg.unizg.hr", "efzg"],
  ])
    assert.equal(websiteLabel(web), label);
  assert.equal(asciiSlug("Učiteljski Đakovo"), "uciteljski-djakovo");
  for (const s of [
    "admin",
    "api",
    "auth",
    "app",
    "issp",
    "merlin",
    "www",
    "a.b",
    "-fer",
    "fer-",
  ])
    assert.ok(!validSubdomain(s));
  for (const s of [
    "javascript:alert(1)",
    "https://a:b@fer.unizg.hr",
    "https://localhost",
    "https://127.0.0.1",
  ])
    assert.equal(officialWebsite(s), null);
  const used = new Set<string>();
  assert.equal(
    allocateSubdomain("pmf", used, "zagreb", "001").subdomain,
    "pmf",
  );
  assert.equal(
    allocateSubdomain("pmf", used, "split", "002").subdomain,
    "pmf-split",
  );
  assert.ok(allocateSubdomain("pmf", used, "split", "003").collision);
  assert.ok(
    rows.every((r) => r.website_verification_status !== "admin_verified"),
  );
});
test("tenant hosts are syntactic candidates only until checked against the database", () => {
  assert.equal(resolveHost("fer.isvu.me", "isvu.me", "", [], ""), null);
  for (const s of ["fer", "fhs", "vuka"])
    assert.equal(
      resolveHost(`${s}.isvu.me`, "isvu.me", "", [], "", true)?.tenantSlug,
      s,
    );
  assert.equal(
    resolveHost("auth.isvu.me", "isvu.me", "", [], "", true)?.module,
    "auth",
  );
  for (const h of ["fer.isvu.me.evil.test", "a.fer.isvu.me", "api.isvu.me"])
    assert.equal(resolveHost(h, "isvu.me", "", [], "", true), null);
  assert.equal(
    new URL(
      institutionUrl(
        "https://auth.isvu.me?next=portal",
        "20000000-0000-4000-8000-000000000001",
      ),
    ).searchParams.get("institution"),
    "20000000-0000-4000-8000-000000000001",
  );
});
