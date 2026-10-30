import type { AcademicData } from "@/lib/academic/data";
import type { ModuleSlug } from "@/lib/modules";
import { hrDate, weekRange, zagrebInput } from "@/lib/academic/time";
import { Section, Table, courseName, person, Empty } from "./shared";
import { AcademicAdmin } from "./admin";
import { ExamList } from "./studomat";
export function Timetable({
  data,
  view,
  base,
  date,
}: {
  data: AcademicData;
  view: string;
  base: string;
  date?: string;
}) {
  const today = zagrebInput(new Date().toISOString()).slice(0, 10);
  let range;
  try {
    range = weekRange(date || today);
  } catch {
    range = weekRange(today);
  }
  const link = (day: string, newView = view) => {
    const u = new URL(base);
    u.searchParams.set("institution", data.institution.id);
    u.searchParams.set("view", newView);
    u.searchParams.set("date", day);
    return u.toString();
  };
  if (view === "Ispitni rokovi")
    return <ExamList data={data} module="raspored" view={view} />;
  if (view === "Dvorane")
    return data.manager ? (
      <AcademicAdmin
        data={data}
        module="raspored"
        view={view}
        actions={["room"]}
      />
    ) : (
      <Section title="Dvorane">
        <Table
          headings={["Dvorana", "Kapacitet"]}
          rows={data.rooms.map((r) => [r.name, r.capacity])}
        />
      </Section>
    );
  if (view === "Upravljanje terminima")
    return (
      <AcademicAdmin
        data={data}
        module="raspored"
        view={view}
        actions={["schedule"]}
      />
    );
  if (view === "Kalendar") {
    const current = new Date(
      (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today) + "T12:00Z",
    );
    const first = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 12),
    );
    const month = first.toISOString().slice(0, 7);
    const last = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0, 12),
    );
    const days = Array.from(
      { length: last.getUTCDate() },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    );
    const previous = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1, 12),
    )
      .toISOString()
      .slice(0, 10);
    const next = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1, 12),
    )
      .toISOString()
      .slice(0, 10);
    return (
      <Section
        title={new Intl.DateTimeFormat("hr-HR", {
          month: "long",
          year: "numeric",
          timeZone: "Europe/Zagreb",
        }).format(first)}
      >
        <nav className="flex justify-between text-sm text-blue-700">
          <a href={link(previous)}>← Prethodni mjesec</a>
          <a href={link(next)}>Sljedeći mjesec →</a>
        </nav>
        <div className="grid grid-cols-7 gap-1 sm:gap-3">
          {["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-bold text-slate-500"
            >
              {day}
            </div>
          ))}
          {Array.from({ length: (first.getUTCDay() + 6) % 7 }, (_, i) => (
            <div key={`blank${i}`} />
          ))}
          {days.map((day) => {
            const lessons = data.schedule.filter((s) =>
              zagrebInput(s.starts_at).startsWith(day),
            );
            const exams = data.exams.filter((e) =>
              zagrebInput(e.starts_at).startsWith(day),
            );
            return (
              <a
                key={day}
                href={link(day, "Tjedni raspored")}
                className={`min-h-20 rounded-lg border p-2 text-xs sm:min-h-28 sm:p-3 ${day === today ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200"}`}
              >
                <span className="font-bold">{Number(day.slice(-2))}</span>
                {lessons.length > 0 && (
                  <span className="mt-2 block rounded bg-blue-100 p-1 text-blue-800">
                    Nastava: {lessons.length}
                  </span>
                )}
                {exams.length > 0 && (
                  <span className="mt-1 block rounded bg-amber-100 p-1 text-amber-900">
                    Ispiti: {exams.length}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </Section>
    );
  }
  const previous = new Date(range.start + "T12:00Z");
  previous.setUTCDate(previous.getUTCDate() - 7);
  const rows = data.schedule
    .filter(
      (s) =>
        Date.parse(s.starts_at) >= Date.parse(range.from) &&
        Date.parse(s.starts_at) < Date.parse(range.to),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <Section title="Tjedni raspored">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <a
          className="text-blue-700"
          href={link(previous.toISOString().slice(0, 10))}
        >
          ← Prethodni tjedan
        </a>
        <strong>
          {range.start} –{" "}
          {new Date(Date.parse(range.end + "T12:00Z") - 86400000)
            .toISOString()
            .slice(0, 10)}
        </strong>
        <a className="text-blue-700" href={link(range.end)}>
          Sljedeći tjedan →
        </a>
      </div>
      <a href={link(today)} className="inline-block text-sm text-blue-700">
        Ovaj tjedan
      </a>
      <Table
        headings={[
          "Dan i vrijeme",
          "Kolegij / nastava",
          "Dvorana",
          "Nastavnik",
          "Grupa",
        ]}
        rows={rows.map((s) => [
          <span key="time">
            {hrDate(s.starts_at)}
            <br />
            <small>do {hrDate(s.ends_at)}</small>
          </span>,
          <span key="title">
            {s.title}
            <br />
            <small>{courseName(data, s.course_id)}</small>
          </span>,
          data.rooms.find((r) => r.id === s.room_id)?.name || "—",
          person(data, s.teacher_id),
          data.groups.find((g) => g.id === s.group_id)?.name || "Sve grupe",
        ])}
      />
      {!rows.length && (
        <p className="text-sm text-slate-500">
          Odaberite drugi tjedan ili pričekajte da nastavnik objavi termine.
        </p>
      )}
    </Section>
  );
}
