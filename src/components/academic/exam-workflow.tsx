import type { AcademicData } from "@/lib/academic/data";
import type { ModuleSlug } from "@/lib/modules";
import { examStateNames, nextExamState } from "@/lib/academic/exam-workflow";
import { hrDate } from "@/lib/academic/time";
import { Submit, inputClass } from "@/components/auth/forms";
import { AcademicHidden, Section, courseName, person } from "./shared";

export function ExamWorkflow({
  data,
  module,
  view,
}: {
  data: AcademicData;
  module: ModuleSlug;
  view: string;
}) {
  if (!data.examWorkflowReady)
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm">
        Za upravljanje stanjima i zaključavanje rokova primijenite migraciju
        202611060002_exam_workflow.sql.
      </p>
    );
  const exams = data.exams.filter(
    (e) =>
      data.manager ||
      data.teachers.some(
        (t) =>
          t.course_id === e.course_id && t.teacher_id === data.account.user.id,
      ),
  );
  return (
    <Section title="Obrada i zaključavanje ispitnih rokova">
      <p className="text-sm text-slate-600">
        Nacrt → otvorene prijave → zatvorene prijave → ispit u tijeku → obrada
        rezultata → zaključan. Za zaključavanje svaka važeća prijava mora imati
        ocjenu ili nedolazak. Otključavanje provodi administrator ili referada
        uz obrazloženje.
      </p>
      {!exams.length && <p>Nema ispitnih rokova. Najprije dodajte novi rok.</p>}
      {[...exams]
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
        .map((exam) => {
          const state = exam.workflow_status!;
          const registrations = data.registrations.filter(
            (r) => r.exam_id === exam.id && r.status === "registered",
          );
          const missing = registrations.filter(
            (r) =>
              !data.grades.some(
                (g) => g.exam_id === exam.id && g.student_id === r.student_id,
              ),
          );
          const next = nextExamState(state);
          const canTransition = state !== "locked" || data.manager;
          const events = data.examEvents
            .filter((e) => e.exam_id === exam.id)
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
          return (
            <details
              key={exam.id}
              className="rounded-xl border border-slate-200 p-5"
            >
              <summary className="cursor-pointer font-semibold">
                {courseName(data, exam.course_id)} · {hrDate(exam.starts_at)} ·{" "}
                {examStateNames[state]}
              </summary>
              <div className="mt-5 space-y-5">
                <p className="text-sm">
                  Važeće prijave: {registrations.length} · Bez ishoda:{" "}
                  {missing.length}
                </p>
                {exam.legacy_workflow && (
                  <p className="text-sm text-amber-800">
                    Postojeći rok koristi prethodni način unosa ocjena. Prvim
                    prijelazom uključujete novi postupak obrade.
                  </p>
                )}
                {missing.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Studenti bez evidentiranog ishoda
                    </summary>
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {missing.map((r) => (
                        <li key={r.id}>{person(data, r.student_id)}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {canTransition && (
                  <form
                    method="post"
                    action="/api/academic/exam-state"
                    className="space-y-3"
                  >
                    <AcademicHidden data={data} module={module} view={view} />
                    <input type="hidden" name="exam_id" value={exam.id} />
                    <input type="hidden" name="expected_status" value={state} />
                    <input type="hidden" name="next_status" value={next} />
                    <label className="block text-sm">
                      Obrazloženje promjene (obvezno)
                      <textarea
                        name="reason"
                        required
                        minLength={10}
                        maxLength={1000}
                        className={inputClass}
                      />
                    </label>
                    <Submit>
                      {state === "locked"
                        ? "Otključaj za ispravak"
                        : `Promijeni u: ${examStateNames[next]}`}
                    </Submit>
                  </form>
                )}
                {state === "locked" && (
                  <p className="text-sm text-blue-900">
                    Rok je zaključan. Uređivanje termina, prijava i rezultata je
                    onemogućeno.
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">
                    Povijest postupka ({events.length})
                  </summary>
                  <ol className="mt-3 space-y-3 text-sm">
                    {events.map((event) => (
                      <li key={event.id}>
                        <strong>
                          {examStateNames[event.previous_status]} →{" "}
                          {examStateNames[event.next_status]}
                        </strong>{" "}
                        · {hrDate(event.occurred_at)} ·{" "}
                        {person(data, event.actor_id)}
                        <p className="whitespace-pre-wrap text-slate-600">
                          {event.reason}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            </details>
          );
        })}
    </Section>
  );
}
