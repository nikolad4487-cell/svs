import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessModule,
  safeModule,
  sameOrigin,
  type Membership,
} from "../src/lib/auth/policy";
import { sessionCookieOptions } from "../src/lib/auth/cookies";
import { resolveHost } from "../src/lib/hosts";
const student: Membership = {
  institution_id: "a",
  user_id: "u",
  role: "student",
};
test("student cannot access system or study administration", () => {
  assert.equal(canAccessModule("admin", false, [student]), false);
  assert.equal(canAccessModule("isvu", false, [student]), false);
  assert.equal(canAccessModule("portal", false, [student]), true);
});
test("institution administrators are not superadministrators", () => {
  assert.equal(
    canAccessModule("admin", false, [
      { ...student, role: "institution_admin" },
    ]),
    false,
  );
  assert.equal(
    canAccessModule("isvu", false, [{ ...student, role: "registrar" }]),
    true,
  );
  assert.equal(canAccessModule("admin", true, []), true);
});
test("no active membership fails closed", () => {
  assert.equal(canAccessModule("portal", false, []), false);
});
test("login redirects allow module names only", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "javascript:alert(1)",
    "../admin",
    null,
  ])
    assert.equal(safeModule(value), "portal");
  assert.equal(safeModule("studomat"), "studomat");
});
test("mutation CSRF rejects foreign and sibling origins", () => {
  assert.equal(
    sameOrigin("https://evil.test", "https://auth.domena.hr"),
    false,
  );
  assert.equal(
    sameOrigin("https://studomat.domena.hr", "https://auth.domena.hr"),
    false,
  );
  assert.equal(sameOrigin(null, "https://auth.domena.hr"), false);
  assert.equal(
    sameOrigin("https://auth.domena.hr", "https://auth.domena.hr"),
    true,
  );
});
test("production cookies are HttpOnly Secure and share only parent domain", () => {
  const options = sessionCookieOptions(resolveHost("auth.domena.hr")!);
  assert.equal(options.domain, ".domena.hr");
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
});
test("Vercel deployment cookies never share public suffix", () => {
  const options = sessionCookieOptions(
    resolveHost("svs.vercel.app", "domena.hr", "", ["svs.vercel.app"])!,
  );
  assert.equal(options.domain, undefined);
  assert.equal(options.secure, true);
});
test("custom local domain supports HTTP shared sessions", () => {
  const options = sessionCookieOptions(
    resolveHost("auth.svs.test", "domena.hr", "svs.test")!,
  );
  assert.equal(options.domain, ".svs.test");
  assert.equal(options.secure, false);
  assert.equal(options.httpOnly, true);
});
