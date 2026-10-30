import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHost, moduleUrl } from "../src/lib/hosts";
import { modules } from "../src/lib/modules";
test("glavna domena i www", () => {
  for (const host of [
    "domena.hr",
    "www.domena.hr",
    "localhost:3000",
    "127.0.0.1:3000",
  ])
    assert.equal(resolveHost(host)?.module, "home");
});
for (const m of modules)
  test(`usmjeravanje ${m.slug}`, () => {
    for (const base of ["domena.hr", "localhost:3000"])
      assert.equal(resolveHost(`${m.slug}.${base}`)?.module, m.slug);
  });
test("odbija nepoznate i zlonamjerne hostove", () => {
  for (const host of [
    "evil.test",
    "x.domena.hr",
    "admin.domena.hr.evil.test",
    "a.admin.domena.hr",
    "domena.hr/path",
    "domena.hr:99999",
    "domena.hr@evil.test",
    "",
  ])
    assert.equal(resolveHost(host), null);
});
test("promjena domene i alternativni lokalni hostname", () => {
  assert.equal(
    resolveHost("studomat.example.hr", "example.hr")?.module,
    "studomat",
  );
  assert.equal(
    resolveHost("merlin.svs.test", "example.hr", "svs.test")?.module,
    "merlin",
  );
});
test("prijelaz između poddomena i lokalni fallback", () => {
  const local = resolveHost("localhost:3000")!;
  assert.equal(moduleUrl("studomat", local), "http://studomat.localhost:3000");
  assert.equal(
    moduleUrl("merlin", local, true),
    "http://localhost:3000/?module=merlin",
  );
  assert.equal(
    moduleUrl("auth", resolveHost("domena.hr")!),
    "https://auth.domena.hr",
  );
});

test("Vercel accepts exact injected deployment hosts with HTTPS module links", () => {
  const deployment = resolveHost("svs-project.vercel.app", "domena.hr", "", [
    "svs-project.vercel.app",
  ]);
  assert.ok(deployment);
  assert.equal(
    moduleUrl("studomat", deployment),
    "https://svs-project.vercel.app/?module=studomat",
  );
  assert.equal(
    moduleUrl("home", deployment),
    "https://svs-project.vercel.app/",
  );
  assert.equal(
    resolveHost("evil.vercel.app", "domena.hr", "", ["svs-project.vercel.app"]),
    null,
  );
  assert.equal(
    resolveHost("admin.svs-project.vercel.app", "domena.hr", "", [
      "svs-project.vercel.app",
    ]),
    null,
  );
});
