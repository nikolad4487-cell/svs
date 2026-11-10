"use client";
import { useEffect, useState } from "react";
import { Search, Star, ArrowUpRight, BookOpen } from "lucide-react";
import type { LearningCourse } from "@/lib/learning/model";
const covers = [
  "from-slate-900 via-indigo-900 to-indigo-600",
  "from-emerald-900 via-teal-800 to-teal-500",
  "from-violet-950 via-purple-800 to-fuchsia-500",
  "from-blue-950 via-sky-800 to-cyan-500",
  "from-orange-950 via-orange-800 to-amber-500",
];
export function CourseCatalogue({
  courses,
  base,
  userId,
}: {
  courses: LearningCourse[];
  base: string;
  userId: string;
}) {
  const [query, setQuery] = useState(""),
    [institution, setInstitution] = useState(""),
    [onlyStars, setOnlyStars] = useState(false),
    [stars, setStars] = useState<string[]>([]);
  const key = `merlin-favourites:${userId}`;
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(stored))
        setStars(stored.filter((id) => typeof id === "string"));
    } catch {}
  }, [key]);
  const toggle = (id: string) => {
    const next = stars.includes(id)
      ? stars.filter((x) => x !== id)
      : [...stars, id];
    setStars(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  const institutions = [
    ...new Map(
      courses.map((c) => [c.institution_id, c.institution_name]),
    ).entries(),
  ];
  const visible = courses.filter(
    (c) =>
      (!institution || c.institution_id === institution) &&
      (!onlyStars || stars.includes(c.id)) &&
      `${c.name} ${c.code} ${c.institution_name} ${c.academic_year_name}`
        .toLocaleLowerCase("hr")
        .includes(query.toLocaleLowerCase("hr")),
  );
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Moji kolegiji</h2>
          <p className="mt-1 text-sm text-slate-500">
            Odaberite kolegij i nastavite s radom.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500">
          Kolegiji: {courses.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-slate-50 px-4">
          <Search size={18} className="text-slate-400" />
          <input
            aria-label="Pretraži kolegije"
            placeholder="Pretraži kolegije…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
          />
        </label>
        <select
          aria-label="Filtriraj ustanovu"
          className="max-w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        >
          <option value="">Sve ustanove</option>
          {institutions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={onlyStars}
          onClick={() => setOnlyStars(!onlyStars)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${onlyStars ? "border-orange-200 bg-orange-50 text-orange-800" : "border-slate-200"}`}
        >
          <Star size={16} />
          Omiljeni
        </button>
      </div>
      {!visible.length && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BookOpen className="mx-auto mb-4 text-slate-300" size={36} />
          <h3 className="font-semibold">Nema kolegija za ovaj prikaz</h3>
          <p className="mt-2 text-sm text-slate-500">
            {courses.length
              ? "Promijenite pretragu ili filtre."
              : "Kolegiji će se pojaviti nakon upisa ili nastavničke dodjele u ISVU-u."}
          </p>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
        {visible.map((c, i) => {
          const href = new URL(base);
          href.searchParams.set("course", c.id);
          href.searchParams.set("view", "Moji kolegiji");
          return (
            <article
              key={c.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`relative flex h-36 items-end overflow-hidden bg-gradient-to-br ${covers[c.code.charCodeAt(0) % covers.length]} p-5 text-white`}
              >
                <span className="absolute -right-7 -top-12 h-44 w-44 rotate-12 rounded-[40px] border-[22px] border-white/10" />
                <span className="absolute right-20 top-16 h-24 w-24 rounded-full border-[14px] border-white/10" />
                <span className="relative rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
                  {c.academic_year_name}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-label={`${stars.includes(c.id) ? "Ukloni iz omiljenih" : "Dodaj u omiljene"}: ${c.name}`}
                  aria-pressed={stars.includes(c.id)}
                  className="absolute right-4 top-4 rounded-full bg-black/15 p-2 backdrop-blur-sm"
                >
                  <Star
                    size={18}
                    fill={stars.includes(c.id) ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">
                    {c.code} · {c.semester_name}
                  </p>
                  <h3 className="mt-2 text-lg font-bold leading-6">
                    <a href={href.toString()}>{c.name}</a>
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {c.institution_name}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    {c.can_manage ? "Nastavnički prostor" : "Upisani kolegij"}
                  </span>
                  <a
                    href={href.toString()}
                    aria-label={`Otvori kolegij: ${c.name}`}
                    className="flex items-center gap-1 text-xs font-bold text-orange-700"
                  >
                    Otvori kolegij
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {stars.length > 0 && (
        <p className="text-xs text-slate-400">
          Omiljeni kolegiji spremljeni su na ovom uređaju.
        </p>
      )}
    </section>
  );
}
