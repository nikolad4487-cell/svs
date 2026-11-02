import type { AcademicData } from "@/lib/academic/data";
import { studentProgress } from "@/lib/academic/student-progress";
import { Section, Table } from "./shared";
export async function StudyProgress({ data }: { data: AcademicData }) {
  const id = data.account.user.id,
    studies = data.studies.filter((s) => s.student_id === id);
  const progress = studentProgress(data.courses, data.exams, data.grades, id);
  const enrolledIds = new Set(
    data.enrollments.filter((e) => e.student_id === id).map((e) => e.course_id),
  );
  const enrolled = data.courses.filter((c) => enrolledIds.has(c.id));
  const credits = enrolled.reduce((sum, c) => sum + Number(c.ects), 0);
  const extras = data.services
    .filter((s) => s.student_id === id && s.kind === "extra_ects")
    .reduce((sum, s) => sum + Number(s.payload.ects || 0), 0);
  const study = [...studies].sort((a, b) =>
    (
      data.years.find((y) => y.id === b.academic_year_id)?.starts_on || ""
    ).localeCompare(
      data.years.find((y) => y.id === a.academic_year_id)?.starts_on || "",
    ),
  )[0];
  const currentIds = new Set(
    data.enrollments
      .filter((e) => e.student_id === id && e.study_id === study?.id)
      .map((e) => e.course_id),
  );
  const currentCourses = data.courses.filter((c) => currentIds.has(c.id));
  const currentProgress = studentProgress(
    currentCourses,
    data.exams,
    data.grades,
    id,
  );
  const currentCredits = currentCourses.reduce(
    (sum, c) => sum + Number(c.ects),
    0,
  );
  const cohort =
    study && data.servicesReady
      ? await data.account.db.rpc("student_cohort_summary", {
          inst: data.institution.id,
          program: study.program_id,
          year_id: study.academic_year_id,
        })
      : null;
  const average = cohort?.data?.available ? cohort.data : null;
  const number = (n: number | null) =>
    n === null
      ? "Nema ocjena"
      : n.toLocaleString("hr-HR", { maximumFractionDigits: 3 });
  return (
    <Section title="Pregled podataka o studiranju">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Moj prosjek", number(progress.average)],
          ["Težinski prosjek", number(progress.weighted)],
          ["Položeni kolegiji", String(progress.passedCourses)],
          ["Stečeni ECTS", String(progress.earned + extras)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-bold text-blue-700">{value}</p>
          </article>
        ))}
      </div>
      <div className="my-6 rounded-xl border bg-white p-5">
        <h3 className="font-bold">Upisani i stečeni ECTS bodovi</h3>
        <p className="my-3">
          Upisano: {credits} · Stečeno na kolegijima: {progress.earned} ·
          Dodatni ECTS: {extras}
        </p>
        <div
          role="img"
          aria-label={`Stečeno ${progress.earned} od ${credits} upisanih ECTS bodova`}
          className="h-6 overflow-hidden rounded bg-slate-100"
        >
          <div
            className="h-full bg-blue-700"
            style={{
              width: `${credits ? Math.min(100, (progress.earned / credits) * 100) : 0}%`,
            }}
          />
        </div>
      </div>
      {average ? (
        <Table
          headings={["Pokazatelj", "Student", "Prosjek generacije"]}
          rows={[
            [
              "Prosjek ocjena",
              number(currentProgress.average),
              number(Number(average.average_grade) || null),
            ],
            [
              "Upisani ECTS",
              currentCredits,
              number(Number(average.average_enrolled_ects)),
            ],
            [
              "Stečeni ECTS",
              currentProgress.earned,
              number(Number(average.average_earned_ects)),
            ],
            [
              "Upisani kolegiji",
              currentCourses.length,
              number(Number(average.average_enrolled_courses)),
            ],
            [
              "Položeni kolegiji",
              currentProgress.passedCourses,
              number(Number(average.average_passed_courses)),
            ],
          ]}
        />
      ) : (
        <p className="text-sm text-slate-500">
          Usporedba s generacijom prikazuje se za isti program i akademsku
          godinu uz najmanje pet studenata. Zasad nema dostupnog agregata.
        </p>
      )}
    </Section>
  );
}
