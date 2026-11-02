import { test } from "node:test";
import assert from "node:assert/strict";
import { emailDomainsInput } from "../src/lib/auth/email-domains";

test("domain input normalizes multiple exact domains", () => {
  assert.deepEqual(emailDomainsInput.parse(" Fakultet.Example, studenti.fakultet.example; fakultet.example\n"), ["fakultet.example", "studenti.fakultet.example"]);
  assert.deepEqual(emailDomainsInput.parse(""), []);
});
test("domain input rejects URLs, addresses, wildcards and malformed DNS labels", () => {
  for (const value of ["https://fakultet.example", "@fakultet.example", "a@fakultet.example", "*.fakultet.example", "-fakultet.example", "fakultet..example", "localhost", "a".repeat(64)+".example"])
    assert.throws(() => emailDomainsInput.parse(value), value);
  assert.throws(() => emailDomainsInput.parse(Array.from({length:21}, (_, i) => `a${i}.example`).join(",")));
});
