import type { AcademicData } from "@/lib/academic/data";
import { earnedCredits } from "@/lib/academic/summary";
import { hrDate } from "@/lib/academic/time";
import { Section, Table, Empty, courseName } from "./shared";
import { AcademicAdmin } from "./admin";
import { Institutions } from "@/components/auth/institutions";
import { Studomat } from "./studomat";
export function Announcements({ data }: { data: AcademicData }) {
  return (
    <Section title="Obavijesti">
      {data.announcements.length ? (
        <div className="space-y-4">
          {[...data.announcements]
            .sort((a, b) => b.published_at.localeCompare(a.published_at))
            .map((a) => (
              <article
                className="rounded-xl border border-slate-200 p-5"
                key={a.id}
              >
                <p className="text-xs text-slate-500">
                  {a.course_id
                    ? courseName(data, a.course_id)
                    : data.institution.name}{" "}
                  · {hrDate(a.published_at)}
                </p>
                <h3 className="mt-3 font-bold">{a.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-500">
                  {a.body}
                </p>
              </article>
            ))}
        </div>
      ) : (
        <Empty>Nema objavljenih obavijesti.</Empty>
      )}
    </Section>
  );
}
export function Portal({
  data,
  view,
  status,
}: {
  data: AcademicData;
  view: string;
  status?: string;
}) {
  if (view === "Osobni podaci") return <Studomat data={data} view={view} />;
  if (view === "Ustanove") return <Institutions status={status} />;
  if (view === "Obavijesti")
    return (
      <div className="space-y-10">
        <Announcements data={data} />
        {(data.manager || data.isTeacher) && (
          <AcademicAdmin
            data={data}
            module="portal"
            view={view}
            actions={["announcement"]}
          />
        )}
      </div>
    );
  const user = data.account.user.id;
  const ownCourses = data.enrollments.filter((e) => e.student_id === user);
  const teaching = data.teachers.filter((t) => t.teacher_id === user);
  const upcoming = data.schedule
    .filter((s) => Date.parse(s.ends_at) >= Date.now())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5);
  const registrations = data.registrations.filter(
    (r) =>
      r.student_id === user &&
      r.status === "registered" &&
      data.exams.some(
        (e) => e.id === r.exam_id && Date.parse(e.starts_at) >= Date.now(),
      ),
  );
  const ownGrades = data.grades
    .filter((g) => g.student_id === user)
    .sort((a, b) => b.graded_at.localeCompare(a.graded_at))
    .slice(0, 5);
  const stats = data.manager
    ? [
        ["Studijski programi", data.programs.length],
        ["Upisi studija", data.studies.length],
        ["Kolegiji", data.courses.length],
        ["Ispitni rokovi", data.exams.length],
      ]
    : data.isTeacher
      ? [
          ["Moji kolegiji", teaching.length],
          [
            "Studenti na kolegijima",
            new Set(
              data.enrollments
                .filter((e) =>
                  teaching.some((t) => t.course_id === e.course_id),
                )
                .map((e) => e.student_id),
            ).size,
          ],
          [
            "Prijave ispita",
            data.registrations.filter((r) => r.status === "registered").length,
          ],
          ["Upisani rezultati", data.grades.length],
        ]
      : [
          ["Upisani kolegiji", ownCourses.length],
          [
            "Ostvareno ECTS",
            earnedCredits(data.courses, data.exams, data.grades, user),
          ],
          ["Prijavljeni ispiti", registrations.length],
          ["Ocjene", data.grades.filter((g) => g.student_id === user).length],
        ];
  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-slate-500">{data.institution.name}</p>
        <h2 className="mt-2 text-2xl font-bold">
          Dobro došli, {data.account.profile.full_name || "korisniče"}
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          {data.studies
            .filter((s) => s.student_id === user)
            .map(
              (s) =>
                `${data.programs.find((p) => p.id === s.program_id)?.name || ""} · ${s.study_year}. godina`,
            )
            .join(" / ")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-5"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-bold text-blue-700">{value}</p>
          </div>
        ))}
      </div>
      <Section title="Sljedeći termini">
        <Table
          headings={["Nastava", "Vrijeme", "Dvorana"]}
          rows={upcoming.map((s) => [
            s.title,
            hrDate(s.starts_at),
            data.rooms.find((r) => r.id === s.room_id)?.name || "—",
          ])}
        />
      </Section>
      {data.isTeacher && (
        <Section title="Kolegiji koje predajete">
          <Table
            headings={["Kolegij", "ECTS", "Studenti"]}
            rows={teaching.map((t) => [
              courseName(data, t.course_id),
              Number(data.courses.find((c) => c.id === t.course_id)?.ects || 0),
              data.enrollments.filter((e) => e.course_id === t.course_id)
                .length,
            ])}
          />
        </Section>
      )}
      {!data.manager && !data.isTeacher && (
        <Section title="Zadnje ocjene">
          <Table
            headings={["Kolegij", "Ocjena", "Datum"]}
            rows={ownGrades.map((g) => [
              courseName(
                data,
                data.exams.find((e) => e.id === g.exam_id)?.course_id || "",
              ),
              g.grade,
              hrDate(g.graded_at),
            ])}
          />
        </Section>
      )}
      <Announcements data={data} />
    </div>
  );
}
