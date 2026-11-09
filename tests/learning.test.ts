import { test } from "node:test";
import assert from "node:assert/strict";
import { learningSchemas, learningError } from "../src/lib/learning/validation";
const id = "10000000-0000-4000-8000-000000000001";
test("learning materials require content and safe external document links", () => {
  const material = {
    course_id: id,
    id: "",
    revision: "0",
    title: "Skripta",
    body: "",
    resource_url: "",
    published: "on",
  };
  assert.equal(learningSchemas.material.safeParse(material).success, false);
  assert.equal(
    learningSchemas.material.safeParse({
      ...material,
      resource_url: "https://documents.example.hr/lecture",
    }).success,
    true,
  );
  for (const resource_url of [
    "javascript:alert(1)",
    "http://documents.example.hr",
    "https://user:password@documents.example.hr/",
  ])
    assert.equal(
      learningSchemas.material.safeParse({ ...material, resource_url }).success,
      false,
    );
});
test("assignment deadlines use Croatian time and points require exact hundredths", () => {
  const assignment = {
    course_id: id,
    id: "",
    revision: "0",
    title: "Zadaća",
    instructions: "Napišite primjer.",
    due_at: "2027-01-15T12:00",
    max_points: "20.50",
    published: "on",
    allow_late: "",
  };
  assert.equal(
    learningSchemas.assignment.parse(assignment).due_at,
    "2027-01-15T11:00:00.000Z",
  );
  assert.equal(
    learningSchemas.assignment.parse({ ...assignment, due_at: "" }).due_at,
    null,
  );
  for (const max_points of ["NaN", "Infinity", "20.001", "", "0", "10001"])
    assert.equal(
      learningSchemas.assignment.safeParse({ ...assignment, max_points })
        .success,
      false,
    );
});
test("learning feedback is bounded and RPC failures become fixed user-facing statuses", () => {
  assert.equal(
    learningSchemas.grade.safeParse({
      submission_id: id,
      revision: "1",
      score: "0",
      feedback: "Pregledano",
    }).success,
    true,
  );
  assert.equal(
    learningSchemas.grade.safeParse({
      submission_id: id,
      revision: "-1",
      score: "0",
      feedback: "x".repeat(5001),
    }).success,
    false,
  );
  assert.equal(learningError("LEARNING_CONFLICT"), "conflict");
  assert.equal(learningError("LEARNING_POINTS_LOCKED"), "points_locked");
  assert.equal(
    learningError("untrusted error contains private data"),
    "invalid",
  );
});
