import {
  BookOpen,
  ClipboardList,
  CircleHelp,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  FileText,
  Clock3,
} from "lucide-react";
import type { learningData } from "@/lib/learning/data";
import { hrDate } from "@/lib/academic/time";
type Data = NonNullable<Awaited<ReturnType<typeof learningData>>>;
export function courseLink(base: string, courseId: string, view: string) {
  const url = new URL(base);
  url.searchParams.set("course", courseId);
  url.searchParams.set("view", view);
  return url.toString();
}
export function courseDeadlines(data: Data) {
  return [
    ...data.assignments
      .filter((a) => a.due_at)
      .map((a) => ({
        id: a.id,
        title: a.title,
        date: a.due_at!,
        kind: "Zadatak",
        view: "Zadaci",
        published: a.published,
      })),
    ...data.quizzes
      .filter((q) => q.closes_at || q.opens_at)
      .map((q) => ({
        id: q.id,
        title: q.title,
        date: q.closes_at || q.opens_at!,
        kind: q.closes_at ? "Rok kviza" : "Otvaranje kviza",
        view: "Kvizovi",
        published: q.published,
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
export function CourseHeader({
  data,
  base,
  view,
  editing,
}: {
  editing?: boolean;
  data: Data;
  base: string;
  view: string;
}) {
  const c = data.course!;
  const tabs = [
    "Moji kolegiji",
    "Materijali",
    "Zadaci",
    "Kvizovi",
    "Bodovi",
    "Rokovi",
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-6 md:p-8">
        <p className="text-xs text-slate-500">
          {c.institution_name} / {c.academic_year_name} / {c.code}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {c.name}
          </h1>
          {c.can_manage &&
            (() => {
              const toggle = new URL(courseLink(base, c.id, view));
              if (editing) toggle.searchParams.delete("edit");
              else toggle.searchParams.set("edit", "1");
              return (
                <a
                  href={toggle.toString()}
                  role="switch"
                  aria-checked={!!editing}
                  className="flex items-center gap-3 text-sm font-medium"
                >
                  Način uređivanja
                  <span
                    className={`relative inline-block h-6 w-11 rounded-full ${editing ? "bg-blue-700" : "bg-slate-300"}`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white ${editing ? "right-1" : "left-1"}`}
                    />
                  </span>
                </a>
              );
            })()}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {c.semester_name} ·{" "}
          {c.can_manage ? "Nastavnički prostor" : "Upisani kolegij"}
        </p>
      </div>
      <nav
        aria-label="Aktivnosti kolegija"
        className="flex gap-5 overflow-x-auto px-6"
      >
        {tabs.map((tab) => (
          <a
            key={tab}
            href={courseLink(base, c.id, tab)}
            className={`shrink-0 border-b-[3px] py-4 text-sm font-semibold ${view === tab ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            aria-current={view === tab ? "page" : undefined}
          >
            {tab === "Moji kolegiji" ? "Kolegij" : tab}
          </a>
        ))}
      </nav>
    </div>
  );
}
export function CourseOverview({ data, base }: { data: Data; base: string }) {
  const c = data.course!;
  const own = data.submissions.filter(
    (s) => s.student_id === data.account.user.id,
  );
  const pending = data.submissions.filter((s) => !s.graded_at).length;
  const publishedAssignments = data.assignments.filter((a) => a.published);
  const completed = publishedAssignments.filter((a) =>
    own.some((s) => s.assignment_id === a.id),
  ).length;
  const stats = [
    ["Materijali", data.materials.length, BookOpen, "Materijali"],
    ["Zadaci", data.assignments.length, ClipboardList, "Zadaci"],
    ["Kvizovi", data.quizzes.length, CircleHelp, "Kvizovi"],
    [
      c.can_manage ? "Za pregled" : "Predano zadataka",
      c.can_manage ? pending : completed,
      CheckCircle2,
      "Predaje",
    ],
  ] as const;
  const upcoming = courseDeadlines(data)
    .filter((e) => new Date(e.date).getTime() >= Date.now())
    .slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(([label, count, Icon, view]) => (
          <a
            key={label}
            href={courseLink(base, c.id, view)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold">{count}</p>
            </div>
            <span className="rounded-xl bg-orange-50 p-3 text-orange-600">
              <Icon size={22} />
            </span>
          </a>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-lg font-bold">Aktivnosti kolegija</h2>
            <span className="text-xs text-slate-400">
              Vaš prostor za učenje
            </span>
          </div>
          {[
            [
              BookOpen,
              "Nastavni materijali",
              "Skripte, prezentacije, video i dokumenti.",
              "Materijali",
              data.materials.length,
            ],
            [
              ClipboardList,
              "Zadaci i predaje",
              "Upute, radovi i povratne informacije.",
              "Zadaci",
              data.assignments.length,
            ],
            [
              CircleHelp,
              "Provjere znanja",
              "Kvizovi s automatskim bodovanjem.",
              "Kvizovi",
              data.quizzes.length,
            ],
          ].map(([Icon, title, copy, view, count]) => {
            const ActivityIcon = Icon as typeof BookOpen;
            return (
              <a
                key={String(view)}
                href={courseLink(base, c.id, String(view))}
                className="flex items-center gap-4 border-b border-slate-200 p-6 last:border-b-0 hover:bg-slate-50"
              >
                <span className="rounded-xl bg-slate-100 p-3 text-slate-500">
                  <ActivityIcon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{String(title)}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {String(copy)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                  {Number(count)}
                </span>
                <ArrowRight size={16} className="text-slate-400" />
              </a>
            );
          })}
          {!c.can_manage && publishedAssignments.length > 0 && (
            <div className="p-6">
              <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
                <span>Predaje zadataka</span>
                <span>
                  {completed}/{publishedAssignments.length}
                </span>
              </div>
              <progress
                className="h-2 w-full accent-orange-500"
                value={completed}
                max={publishedAssignments.length}
                aria-label="Predani zadaci"
              />
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-2">
            <CalendarDays size={18} className="text-orange-600" />
            <h2 className="font-bold">Sljedeći rokovi</h2>
          </div>
          {upcoming.length ? (
            <div className="space-y-4">
              {upcoming.map((e) => (
                <a
                  key={e.id}
                  href={courseLink(base, c.id, e.view)}
                  className="block border-l-2 border-orange-300 pl-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {e.kind}
                    {!e.published ? " · Nacrt" : ""}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{e.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {hrDate(e.date)}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              Nema nadolazećih rokova u ovom kolegiju.
            </p>
          )}
          <a
            className="mt-6 block text-xs font-bold text-orange-700"
            href={courseLink(base, c.id, "Rokovi")}
          >
            Svi rokovi →
          </a>
        </section>
      </div>
    </div>
  );
}
export function CourseDeadlines({ data, base }: { data: Data; base: string }) {
  const entries = courseDeadlines(data);
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Rokovi aktivnosti</h2>
        <p className="mt-2 text-sm text-slate-500">
          Datumi zadataka i kvizova ovog kolegija, prikazani u hrvatskom
          vremenu.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {entries.length ? (
          entries.map((e) => (
            <a
              key={e.id}
              href={courseLink(base, data.course!.id, e.view)}
              className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5 last:border-b-0 hover:bg-slate-50"
            >
              <span className="rounded-xl bg-orange-50 p-3 text-orange-600">
                <Clock3 size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">
                  {e.kind}
                  {!e.published ? " · Nacrt" : ""}
                </p>
                <h3 className="mt-1 font-semibold">{e.title}</h3>
              </div>
              <span className="text-sm text-slate-500">{hrDate(e.date)}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs ${new Date(e.date).getTime() < Date.now() ? "bg-slate-100 text-slate-500" : "bg-orange-50 text-orange-800"}`}
              >
                {new Date(e.date).getTime() < Date.now()
                  ? "Prošlo"
                  : "Nadolazi"}
              </span>
            </a>
          ))
        ) : (
          <p className="p-8 text-sm text-slate-500">
            Aktivnosti još nemaju postavljene rokove.
          </p>
        )}
      </div>
    </section>
  );
}
export function CourseGradebook({ data }: { data: Data }) {
  const rows = [
    ...data.submissions.map((s) => ({
      id: s.id,
      name:
        data.assignments.find((a) => a.id === s.assignment_id)?.title ||
        "Zadatak",
      student: s.student_id,
      kind: "Zadatak",
      score: s.score,
      max:
        data.assignments.find((a) => a.id === s.assignment_id)?.max_points || 0,
      date: s.graded_at,
    })),
    ...data.quizAttempts.map((a) => ({
      id: a.id,
      name: data.quizzes.find((q) => q.id === a.quiz_id)?.title || "Kviz",
      student: a.student_id,
      kind: "Kviz",
      score: a.score,
      max: a.max_points,
      date: a.submitted_at,
    })),
  ];
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Bodovi i povratne informacije</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Rezultati aktivnosti e-učenja. Službene ispitne ocjene i ECTS vode se
          zasebno u ISVU ispitnoj evidenciji.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {rows.length ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-4">Aktivnost</th>
                {data.course!.can_manage && <th className="p-4">Student</th>}
                <th className="p-4">Vrsta</th>
                <th className="p-4">Bodovi</th>
                <th className="p-4">Vrednovano</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-200 last:border-b-0"
                >
                  <td className="p-4 font-semibold">{row.name}</td>
                  {data.course!.can_manage && (
                    <td className="p-4">
                      {data.profiles.find((p) => p.id === row.student)
                        ?.full_name || "Student"}
                    </td>
                  )}
                  <td className="p-4 text-slate-500">{row.kind}</td>
                  <td className="p-4 font-bold">
                    {row.score === null
                      ? "Čeka vrednovanje"
                      : `${row.score}/${row.max}`}
                  </td>
                  <td className="whitespace-nowrap p-4 text-xs text-slate-500">
                    {row.date ? hrDate(row.date) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center">
            <FileText size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">
              Rezultati će se pojaviti nakon predaje i vrednovanja aktivnosti.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
