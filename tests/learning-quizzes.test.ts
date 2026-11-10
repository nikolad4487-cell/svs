import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quizSchema,
  quizSubmissionSchema,
  quizIsOpen,
  type Quiz,
} from "../src/lib/learning/quizzes";
const id = "10000000-0000-4000-8000-000000000001";
const question = {
  prompt: "Koji odgovor je točan?",
  choices: ["Prvi", "Drugi"],
  correct_index: 1,
  points: 2,
};
const form = {
  course_id: id,
  id: "",
  revision: "0",
  title: "Provjera znanja",
  description: "",
  opens_at: "2026-11-10T10:00",
  closes_at: "2026-11-10T12:00",
  published: "on",
  questions: JSON.stringify([question]),
};
test("quiz authors must provide bounded choices, a valid correct answer and Croatian availability dates", () => {
  const parsed = quizSchema.parse(form);
  assert.equal(parsed.opens_at, "2026-11-10T09:00:00.000Z");
  for (const changes of [
    { correct_index: 2 },
    { choices: ["Samo jedan"] },
    { points: 0 },
    { points: 1.5 },
  ])
    assert.equal(
      quizSchema.safeParse({
        ...form,
        questions: JSON.stringify([{ ...question, ...changes }]),
      }).success,
      false,
    );
  assert.equal(
    quizSchema.safeParse({ ...form, closes_at: "2026-11-10T09:00" }).success,
    false,
  );
  assert.equal(
    quizSchema.safeParse({ ...form, questions: "broken" }).success,
    false,
  );
});
test("quiz submissions accept only question identifiers and option indexes; dates include their endpoints", () => {
  assert.deepEqual(
    quizSubmissionSchema.parse({
      quiz_id: id,
      revision: "1",
      answers: JSON.stringify({ [id]: 0 }),
    }).answers,
    { [id]: 0 },
  );
  for (const answers of [
    { [id]: -1 },
    { [id]: 6 },
    { unknown: 1 },
    { [id]: "1" },
  ])
    assert.equal(
      quizSubmissionSchema.safeParse({
        quiz_id: id,
        revision: "1",
        answers: JSON.stringify(answers),
      }).success,
      false,
    );
  const quiz = {
    published: true,
    opens_at: "2026-11-10T09:00:00Z",
    closes_at: "2026-11-10T11:00:00Z",
  } as Quiz;
  assert.equal(quizIsOpen(quiz, Date.parse(quiz.opens_at!)), true);
  assert.equal(quizIsOpen(quiz, Date.parse(quiz.closes_at!) + 1), false);
});
