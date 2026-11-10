"use client";
import { useState } from "react";
import type { Quiz, QuizQuestion } from "@/lib/learning/quizzes";
import { Button } from "@/components/ui/button";
export function QuizAttemptForm({
  quiz,
  questions,
}: {
  quiz: Quiz;
  questions: QuizQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      action="/api/learning/quiz-submit"
      method="post"
      className="space-y-6"
      onSubmit={(event) => {
        if (submitting) {
          event.preventDefault();
          return;
        }
        if (
          !window.confirm(
            "Predati kviz? Nakon predaje odgovore više nije moguće promijeniti.",
          )
        ) {
          event.preventDefault();
          return;
        }
        setSubmitting(true);
      }}
    >
      <input type="hidden" name="course_id" value={quiz.course_id} />
      <input type="hidden" name="return_view" value="Kvizovi" />
      <input type="hidden" name="quiz_id" value={quiz.id} />
      <input type="hidden" name="revision" value={quiz.revision} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />
      {questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-xl border border-slate-200 p-5">
          <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Pitanje {i + 1} · {q.points} bodova
          </legend>
          <p className="mb-4 whitespace-pre-wrap text-sm font-semibold leading-6">
            {q.prompt}
          </p>
          <div className="space-y-2">
            {q.choices.map((choice, ci) => (
              <label
                key={ci}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${answers[q.id] === ci ? "border-orange-300 bg-orange-50 text-orange-950" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <input
                  type="radio"
                  name={`answer_${q.id}`}
                  checked={answers[q.id] === ci}
                  onChange={() => setAnswers({ ...answers, [q.id]: ci })}
                />
                <span className="font-semibold">
                  {String.fromCharCode(65 + ci)}.
                </span>
                {choice}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="text-xs text-slate-500">
        Odgovoreno {Object.keys(answers).length} od {questions.length} pitanja.
        Neodgovorena pitanja donose nula bodova. Odgovori se spremaju tek
        predajom; osvježavanje stranice briše vaš odabir.
      </p>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Predaja…" : "Predaj kviz"}
      </Button>
    </form>
  );
}
