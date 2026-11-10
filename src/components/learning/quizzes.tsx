import type { learningData } from "@/lib/learning/data";
import { quizIsOpen } from "@/lib/learning/quizzes";
import { hrDate } from "@/lib/academic/time";
import { CircleHelp, CheckCircle2 } from "lucide-react";
import { QuizEditor } from "./quiz-editor";
import { QuizAttemptForm } from "./quiz-attempt";
type Data = NonNullable<Awaited<ReturnType<typeof learningData>>>;
export function CourseQuizzes({
  data,
  create,
  sectionId,
  editing,
}: {
  data: Data;
  create?: boolean;
  sectionId?: string;
  editing?: boolean;
}) {
  const {
    course,
    quizzes,
    quizQuestions,
    quizAttempts,
    quizKeys,
    profiles,
    account,
    quizzesReady,
  } = data;
  if (!course) return null;
  if (!quizzesReady)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Kvizovi još nisu uključeni.
        {account.superadmin ? (
          <>
            {" "}
            Primijenite migraciju <code>202611100001_learning_quizzes.sql</code>
            .
          </>
        ) : (
          " Obratite se administratoru ustanove."
        )}
      </div>
    );
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Kvizovi</h2>
        <p className="mt-2 text-sm text-slate-500">
          Provjerite znanje i pregledajte rezultate svojih aktivnosti.
        </p>
      </div>
      {editing && (
        <details
          open={create}
          className="rounded-2xl border border-dashed border-blue-300 bg-white p-6"
        >
          <summary className="cursor-pointer font-semibold text-orange-800">
            Dodaj kviz
          </summary>
          <div className="mt-6">
            <QuizEditor
              courseId={course.id}
              sections={data.sections}
              sectionsReady={data.sectionsReady}
              sectionId={sectionId}
            />
          </div>
        </details>
      )}
      {!quizzes.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <CircleHelp className="mx-auto mb-3 text-violet-300" size={36} />
          <p className="font-semibold">
            Još nema {course.can_manage ? "" : "objavljenih "}kvizova
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Ovdje će se pojaviti provjere znanja ovog kolegija.
          </p>
        </div>
      )}
      {quizzes.map((quiz) => {
        const questions = quizQuestions
          .filter((q) => q.quiz_id === quiz.id)
          .sort((a, b) => a.position - b.position);
        const attempts = quizAttempts.filter((a) => a.quiz_id === quiz.id);
        const own = attempts.find((a) => a.student_id === account.user.id);
        return (
          <article
            key={quiz.id}
            id={quiz.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="space-y-4 p-6">
              <div className="flex items-start gap-4">
                <span className="rounded-xl bg-violet-50 p-3 text-violet-600">
                  <CircleHelp size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[.15em] text-violet-500">
                    Provjera znanja
                    {questions.length ? ` · ${questions.length} pitanja` : ""}
                  </p>
                  <h3 className="mt-1 text-xl font-bold">{quiz.title}</h3>
                </div>
                {!quiz.published && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
                    Nacrt
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-500">
                {quiz.description}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="rounded-lg bg-slate-50 px-3 py-2">
                  Najviše {quiz.max_points} bodova
                </span>
                <span className="rounded-lg bg-slate-50 px-3 py-2">
                  Jedan pokušaj
                </span>
                {quiz.opens_at && (
                  <span className="rounded-lg bg-slate-50 px-3 py-2">
                    Od {hrDate(quiz.opens_at)}
                  </span>
                )}
                {quiz.closes_at && (
                  <span className="rounded-lg bg-slate-50 px-3 py-2">
                    Do {hrDate(quiz.closes_at)}
                  </span>
                )}
              </div>
              {own ? (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-5 text-emerald-900">
                  <CheckCircle2 size={22} />
                  <div>
                    <p className="font-bold">
                      Vaš rezultat: {own.score}/{own.max_points} bodova
                    </p>
                    <p className="mt-1 text-xs">
                      Predano {hrDate(own.submitted_at)}
                    </p>
                  </div>
                </div>
              ) : course.can_submit ? (
                quizIsOpen(quiz) ? (
                  <details className="border-t border-slate-200 pt-4">
                    <summary className="cursor-pointer font-bold text-orange-700">
                      Riješi kviz
                    </summary>
                    <div className="mt-6">
                      <QuizAttemptForm quiz={quiz} questions={questions} />
                    </div>
                  </details>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    Kviz trenutačno nije otvoren za predaju.
                  </p>
                )
              ) : null}
              {course.can_manage && (
                <>
                  {editing && (
                    <details className="border-t border-slate-200 pt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-500">
                        Uredi kviz
                      </summary>
                      <div className="mt-5">
                        <QuizEditor
                          courseId={course.id}
                          quiz={quiz}
                          sections={data.sections}
                          sectionsReady={data.sectionsReady}
                          sectionId={quiz.section_id}
                          initialQuestions={questions.map((q) => ({
                            prompt: q.prompt,
                            choices: q.choices,
                            points: q.points,
                            correct_index:
                              quizKeys.find((k) => k.question_id === q.id)
                                ?.correct_index ?? 0,
                          }))}
                        />
                      </div>
                    </details>
                  )}
                  <details className="border-t border-slate-200 pt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-500">
                      Rezultati studenata ({attempts.length})
                    </summary>
                    <div className="mt-4 space-y-2">
                      {attempts.length ? (
                        attempts.map((a) => (
                          <div
                            key={a.id}
                            className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-4 text-sm"
                          >
                            <span>
                              {profiles.find((p) => p.id === a.student_id)
                                ?.full_name || "Student"}
                            </span>
                            <strong>
                              {a.score}/{a.max_points}
                            </strong>
                            <span className="text-xs text-slate-500">
                              {hrDate(a.submitted_at)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          Još nema predanih pokušaja.
                        </p>
                      )}
                    </div>
                  </details>
                </>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
