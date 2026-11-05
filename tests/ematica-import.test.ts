import { test } from "node:test";
import assert from "node:assert/strict";
import { loginName } from "../scripts/lib/ematica-import.mjs";
test("imported usernames normalize Croatian names and distinguish source identities", () => {
  const login = loginName("Đuro", "Čović", "student-1", "college.example");
  assert.match(login, /^djuro.covic\.[a-f0-9]{12}@college.example$/);
  assert.equal(
    login,
    loginName("Đuro", "Čović", "student-1", "college.example"),
  );
  assert.notEqual(
    login,
    loginName("Đuro", "Čović", "student-2", "college.example"),
  );
});
