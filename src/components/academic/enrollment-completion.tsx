import type { AcademicData } from "@/lib/academic/data";
import type { ModuleSlug } from "@/lib/modules";
import {
  completionChecks,
  completionNames,
} from "@/lib/academic/enrollment-completion";
import { Submit, inputClass } from "@/components/auth/forms";
import { AcademicHidden, Section, person, courseName } from "./shared";
import { hrDate } from "@/lib/academic/time";

export function EnrollmentCompletion({
  data,
  module,
  view,
}: {
  data: AcademicData;
  module: ModuleSlug;
  view: string;
}) {
  const studies = data.manager
    ? data.studies
    : data.studies.filter((s) => s.student_id === data.account.user.id);
  return (
    <Section title="Dovršenost godišnjih upisa">
      <p className="text-sm text-slate-600">
        Aktivan studij i dovršen godišnji upis vode se odvojeno. Novi upis
        omogućuje prijavu ispita nakon provjere referade.
      </p>
      {!data.enrollmentCompletionReady && (
        <p className="rounded-lg bg-amber-50 p-4 text-sm">
          Za ovaj postupak primijenite migraciju
          202611060003_enrollment_completion.sql.
        </p>
      )}
      {studies.map((study) => {
        const status = study.completion_status;
        const enrollments = data.enrollments.filter(
          (e) => e.study_id === study.id,
        );
        const events = data.enrollmentEvents
          .filter((e) => e.study_id === study.id)
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
        return (
          <details
            key={study.id}
            open={!data.manager}
            className="rounded-xl border border-slate-200 p-5"
          >
            <summary className="cursor-pointer font-semibold">
              {data.manager && `${person(data, study.student_id)} · `}
              {
                data.programs.find((p) => p.id === study.program_id)?.name
              } ·{" "}
              {data.years.find((y) => y.id === study.academic_year_id)?.name} ·{" "}
              {status
                ? completionNames[status]
                : "Dovršenost nije evidentirana"}
            </summary>
            <div className="mt-5 space-y-4 text-sm">
              <p>
                Lokalni matični broj: {study.student_number} · Godina studija:{" "}
                {study.study_year}
              </p>
              {status === "legacy_unverified" && (
                <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
                  Ovaj je upis nastao prije uvođenja provjere. Prethodni pristup
                  ispitima ostaje dostupan dok referada ne započne provjeru. Za
                  upis iduće akademske godine potrebno je dovršiti provjeru ovog
                  upisa.
                </p>
              )}
              {status &&
                !["completed", "legacy_unverified"].includes(status) && (
                  <p
                    role="status"
                    className="rounded-lg bg-amber-50 p-3 text-amber-900"
                  >
                    Prijava ispita je blokirana do administrativnog dovršenja
                    upisa. Provjeru provodi referada.
                  </p>
                )}
              <ul className="list-disc pl-5">
                {completionChecks.map(([key, , label]) => (
                  <li key={key}>
                    {study[key] ? "Provjereno" : "Čeka provjeru"} · {label}
                  </li>
                ))}
              </ul>
              <p>
                Upisani kolegiji: {enrollments.length} · ECTS:{" "}
                {enrollments.reduce(
                  (sum, e) =>
                    sum +
                    Number(
                      data.courses.find((c) => c.id === e.course_id)?.ects || 0,
                    ),
                  0,
                )}
              </p>
              <ul className="list-disc pl-5">
                {enrollments.map((e) => (
                  <li key={e.id}>{courseName(data, e.course_id)}</li>
                ))}
              </ul>
              {study.completed_at && (
                <p>
                  Provjeru dovršio/la {person(data, study.completed_by!)} ·{" "}
                  {hrDate(study.completed_at)}
                </p>
              )}
              {data.manager && data.enrollmentCompletionReady && (
                <form
                  method="post"
                  action="/api/academic/complete-enrollment"
                  className="space-y-4"
                >
                  <AcademicHidden data={data} module={module} view={view} />
                  <input type="hidden" name="study_id" value={study.id} />
                  <input
                    type="hidden"
                    name="expected_revision"
                    value={study.completion_revision}
                  />
                  {status === "pending_verification" ? (
                    <>
                      <fieldset className="space-y-3">
                        <legend className="mb-3 font-semibold">
                          Kontrolna lista referade
                        </legend>
                        {completionChecks.map(([key, name, label]) => (
                          <label key={key} className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              name={name}
                              defaultChecked={study[key]}
                              className="mt-1"
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                      <label className="block">
                        Radnja
                        <select
                          name="next_status"
                          className={inputClass}
                          defaultValue="pending_verification"
                        >
                          <option value="pending_verification">
                            Spremi provjeru u tijeku
                          </option>
                          <option value="completed">
                            Dovrši upis u cijelosti
                          </option>
                          <option value="cancelled">
                            Otkaži godišnji upis
                          </option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <input
                      type="hidden"
                      name="next_status"
                      value="pending_verification"
                    />
                  )}
                  <label className="block">
                    Obrazloženje / oznaka provjere
                    <textarea
                      name="reason"
                      minLength={10}
                      maxLength={1000}
                      required
                      className={inputClass}
                    />
                  </label>
                  <Submit>
                    {status === "pending_verification"
                      ? "Spremi odluku referade"
                      : status === "completed"
                        ? "Ponovno otvori provjeru"
                        : "Započni provjeru upisa"}
                  </Submit>
                </form>
              )}
              {data.manager && (
                <details>
                  <summary className="cursor-pointer font-semibold">
                    Povijest provjera ({events.length})
                  </summary>
                  <ol className="mt-3 space-y-3">
                    {events.map((e) => (
                      <li key={e.id}>
                        <strong>
                          {completionNames[e.previous_status]} →{" "}
                          {completionNames[e.next_status]}
                        </strong>{" "}
                        · {hrDate(e.occurred_at)} · {person(data, e.actor_id)}
                        <p className="whitespace-pre-wrap text-slate-600">
                          {e.reason}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          </details>
        );
      })}
      {!studies.length && <p>Nema evidentiranih godišnjih upisa.</p>}
    </Section>
  );
}
