import { z } from "zod";
import { fromZagrebLocal } from "../academic/time";
export type Quiz = {
  id: string;
  institution_id: string;
  course_id: string;
  title: string;
  description: string;
  opens_at: string | null;
  closes_at: string | null;
  published: boolean;
  max_points: number;
  revision: number;
};
export type QuizQuestion = {
  id: string;
  quiz_id: string;
  course_id: string;
  position: number;
  prompt: string;
  choices: string[];
  points: number;
};
export type QuizKey = { question_id: string; correct_index: number };
export type QuizAttempt = {
  id: string;
  course_id: string;
  quiz_id: string;
  student_id: string;
  answers: Record<string, number>;
  score: number;
  max_points: number;
  submitted_at: string;
};
export const questionSchema = z
  .object({
    prompt: z.string().trim().min(2).max(1000),
    choices: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    correct_index: z.number().int().min(0),
    points: z.number().int().min(1).max(100),
  })
  .refine((q) => q.correct_index < q.choices.length);
export type QuizDraftQuestion = z.infer<typeof questionSchema>;
const localTime = z.string().transform((value, ctx) => {
  if (!value) return null;
  try {
    return fromZagrebLocal(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Neispravno vrijeme." });
    return z.NEVER;
  }
});
const json = (value: string, ctx: z.RefinementCtx) => {
  try {
    return JSON.parse(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Neispravan sadržaj kviza." });
    return z.NEVER;
  }
};
export const quizSchema = z
  .object({
    course_id: z.uuid(),
    id: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    revision: z.coerce.number().int().min(0),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000),
    opens_at: localTime,
    closes_at: localTime,
    published: z.enum(["on", ""]).transform((v) => v === "on"),
    questions: z
      .string()
      .max(250000)
      .transform(json)
      .pipe(z.array(questionSchema).min(1).max(20)),
  })
  .refine((v) => !v.opens_at || !v.closes_at || v.closes_at > v.opens_at);
export const quizSubmissionSchema = z.object({
  quiz_id: z.uuid(),
  revision: z.coerce.number().int().min(1),
  answers: z
    .string()
    .max(10000)
    .transform(json)
    .pipe(z.record(z.uuid(), z.number().int().min(0).max(5))),
});
export function quizIsOpen(quiz: Quiz, now = Date.now()) {
  return (
    quiz.published &&
    (!quiz.opens_at || new Date(quiz.opens_at).getTime() <= now) &&
    (!quiz.closes_at || new Date(quiz.closes_at).getTime() >= now)
  );
}
