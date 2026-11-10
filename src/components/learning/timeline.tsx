"use client";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { hrDate } from "@/lib/academic/time";
type Event = {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  date: string;
  kind: string;
  view: string;
  published: boolean;
};
export function DashboardTimeline({
  events,
  base,
}: {
  events: Event[];
  base: string;
}) {
  const [days, setDays] = useState("30"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("date");
  const [now] = useState(Date.now);
  const visible = events
    .filter(
      (e) =>
        (days === "all" ||
          (new Date(e.date).getTime() >= now &&
            new Date(e.date).getTime() <= now + Number(days) * 86400000)) &&
        `${e.title} ${e.courseName} ${e.kind}`
          .toLocaleLowerCase("hr")
          .includes(query.toLocaleLowerCase("hr")),
    )
    .sort((a, b) =>
      sort === "course"
        ? a.courseName.localeCompare(b.courseName, "hr") ||
          a.date.localeCompare(b.date)
        : a.date.localeCompare(b.date),
    );
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <CalendarDays size={21} />
        Vremenska crta
      </h2>
      <div className="my-5 flex flex-wrap gap-3">
        <select
          aria-label="Razdoblje rokova"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white p-2 text-sm"
        >
          <option value="7">Sljedećih 7 dana</option>
          <option value="30">Sljedećih 30 dana</option>
          <option value="90">Sljedećih 90 dana</option>
          <option value="all">Svi rokovi</option>
        </select>
        <select
          aria-label="Poredak rokova"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white p-2 text-sm"
        >
          <option value="date">Prema datumu</option>
          <option value="course">Prema kolegiju</option>
        </select>
        <input
          aria-label="Pretraži rokove"
          placeholder="Pretraži aktivnosti i kolegije…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent p-2 text-sm"
        />
      </div>
      {visible.length ? (
        <div className="divide-y divide-slate-200">
          {visible.map((e) => {
            const href = new URL(base);
            href.searchParams.set("course", e.courseId);
            href.searchParams.set("view", e.view);
            href.hash = e.id;
            return (
              <a
                key={e.id}
                href={href.toString()}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {e.courseName} · {e.kind}
                    {!e.published ? " · Nacrt" : ""}
                  </p>
                  <p className="mt-1 font-semibold text-blue-700">{e.title}</p>
                </div>
                <time dateTime={e.date} className="text-sm text-slate-500">
                  {hrDate(e.date)}
                </time>
              </a>
            );
          })}
        </div>
      ) : (
        <p className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
          Nema rokova za odabrano razdoblje i pretragu.
        </p>
      )}
    </section>
  );
}
