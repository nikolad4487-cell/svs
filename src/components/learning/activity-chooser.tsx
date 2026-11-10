"use client";
import { useRef, useState } from "react";
import {
  File,
  Folder,
  FileText,
  Link2,
  Type,
  ClipboardList,
  CircleHelp,
  Plus,
  X,
  Search,
} from "lucide-react";
const types = [
  [
    "file",
    "Datoteka",
    "Dokument, prezentacija, slika ili video s vašeg uređaja.",
    "Materijali",
    File,
    "Resursi",
  ],
  [
    "folder",
    "Mapa",
    "Skup datoteka na jednom mjestu.",
    "Materijali",
    Folder,
    "Resursi",
  ],
  [
    "page",
    "Stranica",
    "Oblikovani tekst s poveznicama i privitcima.",
    "Materijali",
    FileText,
    "Resursi",
  ],
  [
    "text",
    "Tekst i mediji",
    "Tekst izravno u cjelini kolegija, uz privitke.",
    "Materijali",
    Type,
    "Resursi",
  ],
  [
    "url",
    "Poveznica",
    "Vanjska HTTPS poveznica na nastavni sadržaj.",
    "Materijali",
    Link2,
    "Resursi",
  ],
  [
    "assignment",
    "Zadaća",
    "Upute, rok, predaja rada i nastavničko vrednovanje.",
    "Zadaci",
    ClipboardList,
    "Vrednovanje",
  ],
  [
    "quiz",
    "Kviz",
    "Pitanja s jednim točnim odgovorom i automatskim bodovanjem.",
    "Kvizovi",
    CircleHelp,
    "Vrednovanje",
  ],
] as const;
export function ActivityChooser({
  base,
  courseId,
  sectionId,
  quizzesReady,
}: {
  base: string;
  courseId: string;
  sectionId?: string;
  quizzesReady: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="mx-auto flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-blue-700"
      >
        <Plus size={17} />
        Dodaj aktivnost ili resurs
      </button>
      <dialog
        ref={dialog}
        className="learning-dialog m-auto w-[calc(100%-2rem)] max-w-4xl rounded-xl border border-slate-200 bg-white p-0 text-inherit shadow-xl backdrop:bg-slate-950/40"
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 className="text-xl font-semibold">Dodaj aktivnost ili resurs</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Zatvori izbor aktivnosti"
            className="rounded p-2"
          >
            <X size={22} />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3">
            <Search size={18} />
            <input
              aria-label="Pretraži aktivnosti"
              placeholder="Pretraži aktivnosti…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full min-w-0 bg-transparent py-3 outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {["", "Resursi", "Vrednovanje"].map((c) => (
              <button
                type="button"
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-4 py-2 text-sm ${c === category ? "bg-blue-700 text-white" : "bg-slate-100"}`}
              >
                {c || "Sve"}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {types
              .filter(
                ([kind, title, copy, , , group]) =>
                  (!category || group === category) &&
                  `${title} ${copy}`
                    .toLocaleLowerCase("hr")
                    .includes(query.toLocaleLowerCase("hr")) &&
                  (kind !== "quiz" || quizzesReady),
              )
              .map(([kind, title, copy, view, Icon]) => {
                const href = new URL(base);
                href.searchParams.set("course", courseId);
                href.searchParams.set("view", view);
                href.searchParams.set("create", kind);
                href.searchParams.set("edit", "1");
                if (sectionId) href.searchParams.set("section", sectionId);
                return (
                  <a
                    href={href.toString()}
                    key={kind}
                    className="flex gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-500 hover:bg-blue-50"
                  >
                    <Icon
                      size={26}
                      className={
                        view === "Materijali"
                          ? "shrink-0 text-cyan-600"
                          : "shrink-0 text-pink-600"
                      }
                    />
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {copy}
                      </p>
                    </div>
                  </a>
                );
              })}
          </div>
        </div>
      </dialog>
    </>
  );
}
