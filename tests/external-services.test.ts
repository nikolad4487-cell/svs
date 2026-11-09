import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceLoginUrl } from "../src/lib/external-services";

test("external login links require HTTPS without embedded credentials", () => {
  assert.equal(
    serviceLoginUrl(" https://mail.example.hr/login "),
    "https://mail.example.hr/login",
  );
  for (const value of [
    undefined,
    "",
    "/login",
    "javascript:alert(1)",
    "http://mail.example.hr",
    "https://user:secret@mail.example.hr",
  ])
    assert.equal(serviceLoginUrl(value), null);
});
