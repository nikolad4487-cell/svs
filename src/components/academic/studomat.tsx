import { StudentServices } from "./student-services";
import { StudyProgress } from "./study-progress";
import { serviceDefinitions } from "@/lib/academic/student-services";
import { studentProgress } from "@/lib/academic/student-progress";
import { navigation } from "@/lib/context";
import type { AcademicData } from "@/lib/academic/data";
import { earnedCredits } from "@/lib/academic/summary";
import { hrDate } from "@/lib/academic/time";
import {
  AcademicHidden,
  Section,
  Table,
  Empty,
  person,
  courseName,
} from "./shared";
import { Submit, inputClass } from "@/components/auth/forms";
import { AcademicAdmin } from "./admin";
export function ExamList({
  data,
  view,
  module = "studomat",
}: {
  data: AcademicData;
  view: string;
  module?: "studomat" | "raspored";
}) {
  const own = new Set(
    data.enrollments
      .filter((e) => e.student_id === data.account.user.id)
      .map((e) => e.course_id),
  );
  const visible = data.exams.filter((e) => {
    if (!own.has(e.course_id) && !data.manager && !data.isTeacher) return false;
    const registered = data.registrations.some(
      (r) =>
        r.exam_id === e.id &&
        r.student_id === data.account.user.id &&
        r.status === "registered",
    );
    const graded = data.grades.some(
      (g) => g.exam_id === e.id && g.student_id === data.account.user.id,
    );
    const passed = data.grades.some(
      (g) =>
        g.student_id === data.account.user.id &&
        g.grade > 1 &&
        data.courses.find(
          (c) => c.id === data.exams.find((x) => x.id === g.exam_id)?.course_id,
        )?.code === data.courses.find((c) => c.id === e.course_id)?.code,
    );
    if (view === "Prijava ispita")
      return (
        !registered &&
        !graded &&
        !passed &&
        Date.parse(e.registration_deadline) >= Date.now()
      );
    if (view === "Odjava ispita")
      return (
        registered && !graded && Date.parse(e.withdrawal_deadline) >= Date.now()
      );
    if (view === "Ispiti u tijeku") return registered && !graded;
    if (view === "Pregled ispita") return registered || graded;
    return true;
  });
  return (
    <Section title={view === "Ispiti" ? "Ispitni rokovi" : view}>
      <Table
        headings={[
          "Kolegij",
          "Termin i dvorana",
          "Prijava / odjava do",
          "Status",
          "Radnja",
        ]}
        rows={[...visible]
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((e) => {
            const reg = data.registrations.find(
              (r) =>
                r.exam_id === e.id && r.student_id === data.account.user.id,
            );
            const grade = data.grades.find(
              (g) =>
                g.exam_id === e.id && g.student_id === data.account.user.id,
            );
            const registered = reg?.status === "registered";
            const passed = data.grades.some(
              (g) =>
                g.student_id === data.account.user.id &&
                g.grade > 1 &&
                data.courses.find(
                  (c) =>
                    c.id ===
                    data.exams.find((x) => x.id === g.exam_id)?.course_id,
                )?.code ===
                  data.courses.find((c) => c.id === e.course_id)?.code,
            );
            const can =
              own.has(e.course_id) &&
              !grade &&
              (!passed || registered) &&
              Date.now() <=
                Date.parse(
                  registered ? e.withdrawal_deadline : e.registration_deadline,
                );
            return [
              courseName(data, e.course_id),
              <span key="time">
                {hrDate(e.starts_at)}
                <br />
                <small>
                  {data.rooms.find((r) => r.id === e.room_id)?.name} · kapacitet{" "}
                  {e.capacity}
                </small>
              </span>,
              <span key="deadline">
                {hrDate(e.registration_deadline)}
                <br />
                {hrDate(e.withdrawal_deadline)}
              </span>,
              grade
                ? `Ocjena ${grade.grade}`
                : registered
                  ? "Prijavljen"
                  : reg
                    ? "Odjavljen"
                    : "Nije prijavljen",
              can ? (
                <form
                  key="register"
                  method="post"
                  action="/api/academic/register-exam"
                >
                  <AcademicHidden data={data} module={module} view={view} />
                  <input type="hidden" name="exam_id" value={e.id} />
                  <input
                    type="hidden"
                    name="cancel"
                    value={registered ? "true" : "false"}
                  />
                  <Submit>
                    {registered ? "Odjavi ispit" : "Prijavi ispit"}
                  </Submit>
                </form>
              ) : (
                "—"
              ),
            ];
          })}
      />
    </Section>
  );
}
function Grading({ data, view }: { data: AcademicData; view: string }) {
  return (
    <Section title="Unos rezultata ispita">
      <p className="text-sm text-slate-500">
        Ocjene se unose za održane ispite i prijavljene studente na kolegijima
        na kojima imate ovlasti.
      </p>
      <Table
        headings={[
          "Kolegij i ispit",
          "Student",
          "Ocjena i povratna informacija",
        ]}
        rows={data.registrations
          .filter(
            (r) =>
              r.status === "registered" &&
              data.exams.some(
                (e) =>
                  e.id === r.exam_id &&
                  Date.parse(e.starts_at) <= Date.now() &&
                  (data.manager ||
                    data.teachers.some(
                      (t) =>
                        t.course_id === e.course_id &&
                        t.teacher_id === data.account.user.id,
                    )),
              ),
          )
          .map((r) => {
            const exam = data.exams.find((e) => e.id === r.exam_id)!;
            const grade = data.grades.find(
              (g) => g.exam_id === r.exam_id && g.student_id === r.student_id,
            );
            return [
              <span key="exam">
                {courseName(data, exam.course_id)}
                <br />
                <small>{hrDate(exam.starts_at)}</small>
              </span>,
              person(data, r.student_id),
              <form
                key="grade"
                action="/api/academic/grade"
                method="post"
                className="min-w-60 space-y-3"
              >
                <AcademicHidden data={data} module="studomat" view={view} />
                <input type="hidden" name="exam_id" value={r.exam_id} />
                <input type="hidden" name="student_id" value={r.student_id} />
                <label className="text-xs">
                  Ocjena
                  <select
                    name="grade"
                    defaultValue={String(grade?.grade || "")}
                    required
                    className={inputClass}
                  >
                    <option value="">Odaberite ocjenu</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  Povratna informacija
                  <textarea
                    className={inputClass}
                    name="feedback"
                    defaultValue={grade?.feedback || ""}
                    maxLength={2000}
                  />
                </label>
                <Submit>Spremi ocjenu</Submit>
              </form>,
            ];
          })}
      />
    </Section>
  );
}
export async function Studomat({
  data,
  view,
  courseId,
  academicYear,
}: {
  data: AcademicData;
  view: string;
  courseId?: string;
  academicYear?: string;
}) {
  const ownId = data.account.user.id;
  const ownStudies = data.studies.filter((s) => s.student_id === ownId);
  const ownCourses = data.enrollments.filter((e) => e.student_id === ownId);
  const ownGrades = data.grades.filter((g) => g.student_id === ownId);
  const extraCredits = data.services
    .filter((s) => s.student_id === ownId && s.kind === "extra_ects")
    .reduce((sum, s) => sum + Number(s.payload.ects || 0), 0);
  const url = await navigation();
  if (
    [
      "Osobni podaci",
      "E-mail opcije",
      "Moj račun ustanove",
      "Upute",
      "Kontakt referade",
      ...Object.values(serviceDefinitions).map((d) => d.title),
    ].includes(view)
  )
    return <StudentServices data={data} view={view} yearId={academicYear} />;
  if (view === "Pregled podataka o studiranju")
    return <StudyProgress data={data} />;
  if (["Upisane godine i predmeti", "Aktivni predmeti"].includes(view)) {
    const progress = studentProgress(
      data.courses,
      data.exams,
      data.grades,
      ownId,
    );
    const shown = ownCourses.filter(
      (e) =>
        view !== "Aktivni predmeti" ||
        !progress.passedCodes.includes(
          data.courses.find((c) => c.id === e.course_id)?.code || "",
        ),
    );
    const link = (id: string) => {
      const u = new URL(url("studomat"));
      u.searchParams.set("view", view);
      u.searchParams.set("institution", data.institution.id);
      u.searchParams.set("course", id);
      return u.toString();
    };
    if (courseId) {
      const c = data.courses.find(
        (c) =>
          c.id === courseId && ownCourses.some((e) => e.course_id === c.id),
      );
      if (!c) return <Empty>Nemate upisan taj kolegij.</Empty>;
      const grades = ownGrades.filter(
        (g) => data.exams.find((e) => e.id === g.exam_id)?.course_id === c.id,
      );
      const attendance = data.services.filter(
        (s) =>
          s.student_id === ownId &&
          s.kind === "attendance" &&
          s.payload.course_id === c.id,
      );
      return (
        <div className="space-y-8">
          <Section title={`Detalji predmeta: ${c.name}`}>
            <Table
              headings={["Podatak", "Vrijednost"]}
              rows={[
                ["Naziv", c.name],
                ["Šifra", c.code],
                [
                  "Semestar",
                  data.semesters.find((s) => s.id === c.semester_id)?.name ||
                    "—",
                ],
                ["Izborna grupa", c.elective_group || "Nije u izbornoj grupi"],
                ["Predavanja", c.lecture_hours ?? 0],
                ["Vježbe", c.exercise_hours ?? 0],
                ["ECTS", c.ects],
              ]}
            />
          </Section>
          <Section title="Tjedni plan nastave">
            <p className="whitespace-pre-wrap">
              {c.teaching_plan || "Plan nastave nije evidentiran."}
            </p>
            <Table
              headings={["Termin", "Tema"]}
              rows={data.schedule
                .filter((s) => s.course_id === c.id)
                .map((s) => [hrDate(s.starts_at), s.title])}
            />
          </Section>
          <Section title="Prisustvo na nastavi">
            <Table
              headings={["Datum", "Održano sati", "Prisutno sati"]}
              rows={attendance.map((a) => [
                String(a.payload.date),
                String(a.payload.held_hours),
                String(a.payload.attended_hours),
              ])}
            />
          </Section>
          <Section title="Ispiti predmeta">
            <Table
              headings={["Termin", "Ocjena", "Napomena"]}
              rows={grades.map((g) => [
                hrDate(
                  data.exams.find((e) => e.id === g.exam_id)?.starts_at ||
                    g.graded_at,
                ),
                g.grade,
                g.feedback || "—",
              ])}
            />
          </Section>
          <a className="text-blue-700 underline" href={link("")}>
            Natrag na predmete
          </a>
        </div>
      );
    }
    return (
      <div className="space-y-8">
        <Section title="Upisane godine">
          <Table
            headings={[
              "Program",
              "Akademska godina",
              "Godina studija",
              "Matični broj",
              "Status",
            ]}
            rows={ownStudies.map((s) => [
              data.programs.find((p) => p.id === s.program_id)?.name || "—",
              data.years.find((y) => y.id === s.academic_year_id)?.name || "—",
              s.study_year,
              s.student_number,
              s.status,
            ])}
          />
        </Section>
        <Section title={view}>
          <Table
            headings={[
              "Predmet",
              "Izborna grupa",
              "Godina / semestar",
              "Predavanja",
              "Vježbe",
              "ECTS",
              "Status",
              "Detalji",
            ]}
            rows={shown.map((e) => {
              const c = data.courses.find((c) => c.id === e.course_id);
              const sem = data.semesters.find((s) => s.id === c?.semester_id);
              return [
                c?.name || "—",
                c?.elective_group || "—",
                `${data.years.find((y) => y.id === sem?.academic_year_id)?.name || "—"} · ${sem?.name || ""}`,
                c?.lecture_hours ?? 0,
                c?.exercise_hours ?? 0,
                c?.ects || 0,
                progress.passedCodes.includes(c?.code || "")
                  ? "Položen"
                  : "Aktivan",
                <a
                  key={e.id}
                  className="text-blue-700 underline"
                  href={link(e.course_id)}
                >
                  Detalji
                </a>,
              ];
            })}
          />
        </Section>
      </div>
    );
  }
  if (view === "Ocjenjivanje")
    return data.manager || data.isTeacher ? (
      <Grading data={data} view={view} />
    ) : (
      <Empty>Nemate ovlasti za ocjenjivanje.</Empty>
    );
  if (
    [
      "Ispiti",
      "Prijava ispita",
      "Odjava ispita",
      "Ispiti u tijeku",
      "Pregled ispitnih rokova",
      "Pregled ispita",
    ].includes(view)
  )
    return (
      <div className="space-y-10">
        <ExamList data={data} view={view} />
        {(data.manager || data.isTeacher) && (
          <AcademicAdmin
            data={data}
            module="studomat"
            view={view}
            actions={["exam"]}
          />
        )}
      </div>
    );
  if (view === "Ocjene" || view === "ECTS bodovi")
    return (
      <Section title={view}>
        <div className="rounded-xl bg-blue-50 p-6 text-blue-900">
          <p className="text-sm">Ostvareni ECTS bodovi</p>
          <p className="mt-2 text-4xl font-bold">
            {earnedCredits(data.courses, data.exams, data.grades, ownId) +
              extraCredits}
          </p>
          <p className="mt-3 text-xs">
            Bodovi se priznaju samo za položene kolegije, jednom po šifri
            kolegija, uz zasebno priznate dodatne ECTS bodove ({extraCredits}).
          </p>
        </div>
        <Table
          headings={[
            "Kolegij",
            "Ispit",
            "Ocjena",
            "ECTS",
            "Povratna informacija",
          ]}
          rows={ownGrades
            .sort((a, b) => b.graded_at.localeCompare(a.graded_at))
            .map((g) => {
              const exam = data.exams.find((e) => e.id === g.exam_id);
              const course = data.courses.find((c) => c.id === exam?.course_id);
              return [
                course?.name || "Kolegij",
                exam ? hrDate(exam.starts_at) : "—",
                g.grade,
                g.grade > 1 ? String(course?.ects || 0) : "0",
                g.feedback || "—",
              ];
            })}
        />
      </Section>
    );
  if (view === "Kolegiji")
    return (
      <Section title="Upisani kolegiji">
        <Table
          headings={[
            "Kolegij",
            "Studijski program",
            "Semestar",
            "ECTS",
            "Nastavnici",
          ]}
          rows={ownCourses.map((e) => {
            const c = data.courses.find((c) => c.id === e.course_id);
            return [
              c ? `${c.code} · ${c.name}` : "—",
              data.programs.find((p) => p.id === c?.program_id)?.name || "—",
              data.semesters.find((s) => s.id === c?.semester_id)?.name || "—",
              String(c?.ects || 0),
              data.teachers
                .filter((t) => t.course_id === c?.id)
                .map((t) => person(data, t.teacher_id))
                .join(", ") || "—",
            ];
          })}
        />
      </Section>
    );
  return (
    <Section title="Pregled studija">
      <StudyProgress data={data} />
      <Table
        headings={[
          "Program",
          "Akademska godina",
          "Godina studija",
          "Matični broj",
          "Status",
        ]}
        rows={ownStudies.map((s) => [
          data.programs.find((p) => p.id === s.program_id)?.name || "—",
          data.years.find((y) => y.id === s.academic_year_id)?.name || "—",
          s.study_year,
          s.student_number,
          s.status === "active"
            ? "Aktivan"
            : s.status === "completed"
              ? "Završen"
              : "Mirovanje",
        ])}
      />
      <p className="text-sm text-slate-500">
        Upisanih kolegija: {ownCourses.length} · Ostvareno ECTS:{" "}
        {earnedCredits(data.courses, data.exams, data.grades, ownId) +
          extraCredits}
      </p>
    </Section>
  );
}
