"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Quiz, QuizDraftQuestion } from "@/lib/learning/quizzes";
import { zagrebInput } from "@/lib/academic/time";
import { inputClass } from "@/components/auth/forms";
import { Button } from "@/components/ui/button";
const blank = (): QuizDraftQuestion => ({
  prompt: "",
  choices: ["", ""],
  correct_index: 0,
  points: 1,
});
export function QuizEditor({
  courseId,
  quiz,
  initialQuestions,
}: {
  courseId: string;
  quiz?: Quiz;
  initialQuestions?: QuizDraftQuestion[];
}) {
  const [questions, setQuestions] = useState<QuizDraftQuestion[]>(
    initialQuestions || [blank()],
  );
  const update = (index: number, patch: Partial<QuizDraftQuestion>) =>
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  return (
    <form action="/api/learning/quiz" method="post" className="space-y-5">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="return_view" value="Kvizovi" />
      <input type="hidden" name="id" value={quiz?.id || ""} />
      <input type="hidden" name="revision" value={quiz?.revision || 0} />
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      <label className="block text-sm font-semibold">
        Naziv kviza
        <input
          name="title"
          className={inputClass}
          maxLength={200}
          minLength={2}
          required
          defaultValue={quiz?.title}
        />
      </label>
      <label className="block text-sm font-semibold">
        Upute za kviz
        <textarea
          name="description"
          className={inputClass}
          maxLength={5000}
          rows={3}
          defaultValue={quiz?.description}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Dostupno od (hrvatsko vrijeme)
          <input
            type="datetime-local"
            name="opens_at"
            className={inputClass}
            defaultValue={quiz?.opens_at ? zagrebInput(quiz.opens_at) : ""}
          />
        </label>
        <label className="text-sm font-semibold">
          Dostupno do (hrvatsko vrijeme)
          <input
            type="datetime-local"
            name="closes_at"
            className={inputClass}
            defaultValue={quiz?.closes_at ? zagrebInput(quiz.closes_at) : ""}
          />
        </label>
      </div>
      <div className="space-y-4">
        {questions.map((q, index) => (
          <fieldset
            key={index}
            className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <legend className="px-2 text-sm font-bold">
              Pitanje {index + 1}
            </legend>
            <label className="block text-sm font-semibold">
              Tekst pitanja {index + 1}
              <textarea
                className={inputClass}
                value={q.prompt}
                onChange={(e) => update(index, { prompt: e.target.value })}
                minLength={2}
                maxLength={1000}
                required
                rows={2}
              />
            </label>
            {q.choices.map((choice, ci) => (
              <div key={ci} className="flex items-end gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  Odgovor {String.fromCharCode(65 + ci)}
                  <input
                    className={inputClass}
                    value={choice}
                    onChange={(e) =>
                      update(index, {
                        choices: q.choices.map((value, i) =>
                          ci === i ? e.target.value : value,
                        ),
                      })
                    }
                    required
                    maxLength={200}
                  />
                </label>
                {q.choices.length > 2 && (
                  <button
                    type="button"
                    className="rounded-lg p-3 text-slate-500"
                    aria-label={`Ukloni odgovor ${String.fromCharCode(65 + ci)} iz pitanja ${index + 1}`}
                    onClick={() =>
                      update(index, {
                        choices: q.choices.filter((_, i) => i !== ci),
                        correct_index:
                          q.correct_index === ci
                            ? 0
                            : q.correct_index > ci
                              ? q.correct_index - 1
                              : q.correct_index,
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {q.choices.length < 6 && (
              <button
                type="button"
                className="text-xs font-bold text-orange-700"
                onClick={() => update(index, { choices: [...q.choices, ""] })}
              >
                + Dodaj odgovor
              </button>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Točan odgovor {index + 1}
                <select
                  className={inputClass}
                  value={q.correct_index}
                  onChange={(e) =>
                    update(index, { correct_index: Number(e.target.value) })
                  }
                >
                  {q.choices.map((_, ci) => (
                    <option key={ci} value={ci}>
                      {String.fromCharCode(65 + ci)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Bodovi pitanja {index + 1}
                <input
                  type="number"
                  className={inputClass}
                  value={q.points}
                  min={1}
                  max={100}
                  required
                  onChange={(e) =>
                    update(index, { points: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {questions.length > 1 && (
              <button
                type="button"
                className="text-xs font-semibold text-red-700"
                onClick={() =>
                  setQuestions(questions.filter((_, i) => i !== index))
                }
              >
                Ukloni pitanje {index + 1}
              </button>
            )}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {questions.length < 20 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuestions([...questions, blank()])}
          >
            <Plus size={16} />
            Dodaj pitanje
          </Button>
        )}
        <span className="text-sm text-slate-500">
          Ukupno {questions.reduce((sum, q) => sum + q.points, 0)} bodova
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={quiz?.published}
        />
        Objavljeno studentima
      </label>
      <p className="text-xs leading-5 text-slate-500">
        Jedan pokušaj po studentu. Nakon prve predaje pitanja i točni odgovori
        se zaključavaju. Možete promijeniti naziv, upute, dostupnost i objavu.
      </p>
      <Button type="submit">Spremi kviz</Button>
    </form>
  );
}
