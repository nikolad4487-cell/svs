import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHost, moduleUrl } from "../src/lib/hosts";
import { publicRoute, facultyUrl, validFaculty } from "../src/lib/routes";
const host = (name: string) => resolveHost(name, "isvu.me")!;
test("production central portal and both administrations use root-domain paths; referada retains its subdomain", () => {
  for (const [module, url] of [
    ["portal", "https://isvu.me/admin"],
    ["isvu", "https://isvu.me/admin/studiji"],
    ["admin", "https://isvu.me/admin/sustav"],
    ["referada", "https://referada.isvu.me"],
    ["studomat", "https://studomat.isvu.me"],
    ["merlin", "https://merlin.isvu.me"],
    ["auth", "https://auth.isvu.me"],
  ] as const)
    assert.equal(moduleUrl(module, host("auth.isvu.me")), url);
  for (const [path, module] of [
    ["/admin", "portal"],
    ["/admin/studiji", "isvu"],
    ["/admin/sustav", "admin"],
  ] as const)
    assert.equal(
      publicRoute(host("isvu.me"), path, new URLSearchParams())?.module,
      module,
    );
  assert.equal(
    publicRoute(
      host("isvu.me"),
      "/admin/sustav",
      new URLSearchParams("module=studomat"),
    )?.module,
    "admin",
  ); // Production ignores preview-only module overrides.
});
test("faculty paths are short validated labels and cannot become redirect destinations or internal routes", () => {
  for (const slug of ["ufzg", "geofzg", "vu-karlovac"]) {
    assert.deepEqual(
      publicRoute(host("raspored.isvu.me"), `/${slug}`, new URLSearchParams()),
      { module: "raspored", faculty: slug },
    );
    assert.equal(
      facultyUrl("https://raspored.isvu.me", slug),
      `https://raspored.isvu.me/${slug}`,
    );
  }
  for (const slug of [
    "../admin",
    "https://evil.test",
    "/ufzg",
    "UFZG",
    "ufzg/geofzg",
    "ufzg%2fgeofzg",
    "-ufzg",
    "",
  ])
    assert.equal(validFaculty(slug), false);
  for (const path of ["/sites/admin", "/ufzg/details", "/admin/no-such-page"])
    assert.equal(
      publicRoute(host("raspored.isvu.me"), path, new URLSearchParams()),
      null,
    );
  assert.equal(
    publicRoute(host("isvu.me"), "/admin/no-such-page", new URLSearchParams()),
    null,
  );
});
test("local and Vercel preview aliases remain available together with central paths", () => {
  const local = host("localhost:3000");
  assert.equal(
    publicRoute(local, "/admin/sustav", new URLSearchParams())?.module,
    "admin",
  );
  assert.equal(
    publicRoute(local, "/admin/sustav", new URLSearchParams("module=studomat")),
    null,
  );
  assert.deepEqual(
    publicRoute(local, "/geofzg", new URLSearchParams("module=raspored")),
    { module: "raspored", faculty: "geofzg" },
  );
  assert.equal(
    facultyUrl("http://localhost:3000/?module=raspored", "ufzg"),
    "http://localhost:3000/ufzg?module=raspored",
  );
  assert.equal(
    publicRoute(local, "/", new URLSearchParams("module=unknown")),
    null,
  );
});
