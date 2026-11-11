import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moneySchema,
  accountSchema,
  transactionSchema,
  parseRecord,
  financialSummary,
  zagrebDay,
  type Transaction,
} from "../src/lib/issp/model";
import { canAccessModule, safeModule } from "../src/lib/auth/policy";
import { resolveHost, moduleUrl } from "../src/lib/hosts";
test("ISSP has a canonical subdomain and students or institution staff can enter, teachers alone cannot", () => {
  assert.equal(resolveHost("issp.isvu.me", "isvu.me")?.module, "issp");
  assert.equal(
    moduleUrl("issp", resolveHost("isvu.me", "isvu.me")!),
    "https://issp.isvu.me",
  );
  assert.equal(safeModule("issp"), "issp");
  for (const role of ["student", "registrar", "institution_admin"] as const)
    assert.ok(
      canAccessModule("issp", false, [
        { institution_id: "i", user_id: "u", role },
      ]),
    );
  assert.ok(
    !canAccessModule("issp", false, [
      { institution_id: "i", user_id: "u", role: "teacher" },
    ]),
  );
  assert.ok(!canAccessModule("issp", false, []));
});
test("ISSP financial input uses exact cents, bounded dates and explicit criteria", () => {
  assert.equal(moneySchema.parse("5,34"), 534);
  assert.equal(moneySchema.parse("0.01"), 1);
  for (const value of ["-1", "1.234", "1e3", "Infinity", "1000001"])
    assert.ok(!moneySchema.safeParse(value).success);
  assert.throws(() =>
    parseRecord("work_criterion", {
      criterion: "student",
      status: "automatically_true",
    }),
  );
  assert.throws(() =>
    parseRecord("employment", {
      status: "not_employed",
      description: "Osobna izjava",
      checked_on: "2026-02-30",
    }),
  );
  assert.throws(() =>
    parseRecord("special_right", {
      title: "Pravo",
      starts_on: "2026-11-11",
      ends_on: "2026-11-10",
    }),
  );
  assert.equal(
    parseRecord("work_criterion", { criterion: "student", status: "unknown" })
      .status,
    "unknown",
  );
  assert.ok(
    !accountSchema.safeParse({
      dining_enabled: "on",
      rights_level: "2",
      valid_from: "2026-12-01",
      valid_until: "2026-11-01",
      daily_support: "5,34",
      reference: "OD-1",
      note: "",
    }).success,
  );
  assert.ok(
    !transactionSchema.safeParse({
      kind: "purchase",
      amount: "5",
      total: "4",
      provider: "Menza",
      reference: "R-1",
      description: "",
      occurred_at: "2026-11-11T12:00",
    }).success,
  );
});
test("ISSP balance and today's consumption account for reversals in Croatian time", () => {
  const rows = [
    {
      id: "grant",
      kind: "allocation",
      delta_cents: 1000,
      occurred_at: "2026-11-10T12:00:00Z",
      reverses_id: null,
    },
    {
      id: "first",
      kind: "purchase",
      delta_cents: -200,
      occurred_at: "2026-11-10T23:30:00Z",
      reverses_id: null,
    },
    {
      id: "second",
      kind: "purchase",
      delta_cents: -100,
      occurred_at: "2026-11-11T09:00:00Z",
      reverses_id: null,
    },
    {
      id: "reverse",
      kind: "reversal",
      delta_cents: 200,
      occurred_at: "2026-11-11T10:00:00Z",
      reverses_id: "first",
    },
  ] as Transaction[];
  const summary = financialSummary(rows, "2026-11-11");
  assert.equal(summary.balance, 900);
  assert.equal(summary.spentToday, 100);
  assert.equal(zagrebDay(new Date("2026-11-10T23:30:00Z")), "2026-11-11");
});

test("current dining rights require an explicit decision, valid dates and no effective termination", async () => {
  const { diningRightsActive } = await import("../src/lib/issp/model");
  const account = {
    id: "a",
    dining_enabled: true,
    valid_from: "2026-10-01",
    valid_until: "2027-09-30",
  } as import("../src/lib/issp/model").Account;
  assert.ok(diningRightsActive(account, [], "2026-11-11"));
  assert.ok(!diningRightsActive(account, [], "2027-10-01"));
  assert.ok(
    !diningRightsActive(
      { ...account, dining_enabled: false },
      [],
      "2026-11-11",
    ),
  );
  const termination = {
    id: "termination",
    reference: "TEST",
    revision: 1,
    updated_at: "2026-11-01T00:00:00Z",
    account_id: "a",
    kind: "termination",
    active: true,
    payload: { date: "2026-11-01" },
  } as import("../src/lib/issp/model").IsspRecord;
  assert.ok(!diningRightsActive(account, [termination], "2026-11-11"));
  assert.ok(
    diningRightsActive(
      account,
      [{ ...termination, active: false }],
      "2026-11-11",
    ),
  );
});
