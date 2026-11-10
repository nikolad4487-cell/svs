import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  FileText,
  ClipboardList,
  CircleHelp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { learningData } from "@/lib/learning/data";
import type { Section } from "@/lib/learning/model";
import { ActivityChooser } from "./activity-chooser";
import { RichContent } from "./rich-content";
import { LearningAttachments } from "./attachments";
import { courseLink } from "./course-overview";
type Data = NonNullable<Awaited<ReturnType<typeof learningData>>>;
const fieldClass =
  "mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm";
function ReturnFields({
  courseId,
  revision = 0,
  id = "",
}: {
  courseId: string;
  revision?: number;
  id?: string;
}) {
  return (
    <>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="return_view" value="Moji kolegiji" />
      <input type="hidden" name="return_edit" value="1" />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="id" value={id} />
    </>
  );
}
function SectionEditor({
  courseId,
  section,
}: {
  courseId: string;
  section?: Section;
}) {
  return (
    <form
      action="/api/learning/section"
      method="post"
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <ReturnFields
        courseId={courseId}
        revision={section?.revision}
        id={section?.id}
      />
      <label className="block text-sm font-medium">
        Naziv cjeline
        <input
          name="title"
          className={fieldClass}
          defaultValue={section?.title}
          required
          minLength={2}
          maxLength={200}
        />
      </label>
      <label className="block text-sm font-medium">
        Opis cjeline
        <textarea
          name="summary"
          className={fieldClass}
          defaultValue={section?.summary}
          rows={3}
          maxLength={5000}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={section?.published ?? true}
        />
        Vidljivo studentima
      </label>
      <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
        Spremi cjelinu
      </button>
    </form>
  );
}
export function CourseSections({
  data,
  base,
  editing,
}: {
  data: Data;
  base: string;
  editing: boolean;
}) {
  const course = data.course!;
  const groups: (Section | null)[] = [null, ...data.sections];
  const activities = [
    ...data.materials.map((m) => ({
      ...m,
      kind: "material",
      view: "Materijali",
      label: {
        text: "Tekst i mediji",
        file: "Datoteka",
        folder: "Mapa",
        page: "Stranica",
        url: "Poveznica",
      }[m.resource_kind || "text"],
      body: m.body,
      rich_body: m.rich_body,
    })),
    ...data.assignments.map((a) => ({
      ...a,
      kind: "assignment",
      view: "Zadaci",
      label: "Zadaća",
      body: "",
      rich_body: null,
    })),
    ...data.quizzes.map((q) => ({
      ...q,
      kind: "quiz",
      view: "Kvizovi",
      label: "Kviz",
      body: "",
      rich_body: null,
    })),
  ].sort(
    (a, b) =>
      (a.sort_order || 1) - (b.sort_order || 1) ||
      a.id.localeCompare(b.id) ||
      a.kind.localeCompare(b.kind),
  );
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-slate-100 p-5 lg:sticky lg:top-24">
        <h2 className="mb-4 border-b border-slate-300 pb-4 text-sm font-bold">
          Indeks kolegija
        </h2>
        <nav aria-label="Cjeline kolegija" className="space-y-5">
          {groups.map((s) => (
            <div key={s?.id || "general"}>
              <a
                href={`#section-${s?.id || "general"}`}
                className="text-sm font-semibold"
              >
                {s?.title || "Općenito"}
                {s && !s.published ? " · Skriveno" : ""}
              </a>
              <div className="mt-2 space-y-2 border-l border-slate-300 pl-3">
                {activities
                  .filter((a) => (a.section_id || null) === (s?.id || null))
                  .map((a) => (
                    <a
                      key={a.id}
                      className="block text-xs leading-5 text-slate-500 hover:text-blue-700"
                      href={`#activity-${a.id}`}
                    >
                      {a.title}
                    </a>
                  ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 space-y-6">
        {course.can_manage && (
          <p className="text-sm text-slate-500">
            {editing
              ? "Uređivanje je uključeno. Dodajte cjeline, premjestite sadržaj i postavite vidljivost studentima."
              : "Za uređivanje cjelina i dodavanje sadržaja uključite način uređivanja iznad kolegija."}
          </p>
        )}
        {groups.map((s) => {
          const items = activities.filter(
            (a) => (a.section_id || null) === (s?.id || null),
          );
          return (
            <section
              key={s?.id || "general"}
              id={`section-${s?.id || "general"}`}
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <details open>
                <summary className="cursor-pointer border-b border-slate-200 p-5 text-xl font-semibold">
                  {s?.title || "Općenito"}
                  {s && !s.published && (
                    <span className="ml-3 inline-flex items-center gap-1 text-xs font-normal text-slate-500">
                      <EyeOff size={14} />
                      Skriveno studentima
                    </span>
                  )}
                </summary>
                <div className="space-y-4 p-5">
                  {s?.summary && (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-500">
                      {s.summary}
                    </p>
                  )}
                  {editing && s && (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <details className="min-w-0 flex-1">
                        <summary className="flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-blue-700">
                          <Pencil size={14} />
                          Uredi cjelinu
                        </summary>
                        <div className="mt-3">
                          <SectionEditor courseId={course.id} section={s} />
                        </div>
                      </details>
                      <form
                        action="/api/learning/section-order"
                        method="post"
                        className="flex gap-1"
                      >
                        <ReturnFields
                          courseId={course.id}
                          revision={s.revision}
                          id={s.id}
                        />
                        <button
                          name="direction"
                          value="up"
                          title="Pomakni cjelinu gore"
                          aria-label={`Pomakni cjelinu gore: ${s.title}`}
                          className="rounded border border-slate-200 p-2"
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          name="direction"
                          value="down"
                          title="Pomakni cjelinu dolje"
                          aria-label={`Pomakni cjelinu dolje: ${s.title}`}
                          className="rounded border border-slate-200 p-2"
                        >
                          <ArrowDown size={15} />
                        </button>
                        {!items.length && (
                          <button
                            name="direction"
                            value="delete"
                            aria-label={`Obriši praznu cjelinu: ${s.title}`}
                            className="rounded border border-slate-200 p-2 text-red-700"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </form>
                    </div>
                  )}
                  {!items.length && (
                    <p className="py-4 text-sm text-slate-400">
                      U ovoj cjelini još nema aktivnosti.
                    </p>
                  )}
                  {items.map((a) => {
                    const Icon =
                      a.kind === "quiz"
                        ? CircleHelp
                        : a.kind === "assignment"
                          ? ClipboardList
                          : FileText;
                    const href = new URL(courseLink(base, course.id, a.view));
                    href.hash = a.id;
                    const files = data.files.filter(
                      (f) =>
                        f.status === "ready" &&
                        (f.material_id === a.id || f.assignment_id === a.id),
                    );
                    return (
                      <article
                        key={a.id}
                        id={`activity-${a.id}`}
                        className="scroll-mt-24 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <Icon
                            size={26}
                            className={`shrink-0 ${a.kind === "material" ? "text-cyan-600" : "text-pink-600"}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {a.label}
                              {!a.published ? " · Nacrt" : ""}
                            </p>
                            <a
                              href={href.toString()}
                              className="mt-1 block break-words font-semibold hover:text-blue-700"
                            >
                              {a.title}
                            </a>
                          </div>
                          {editing && (
                            <form
                              action="/api/learning/activity-order"
                              method="post"
                              className="flex gap-1"
                            >
                              <ReturnFields
                                courseId={course.id}
                                id={a.id}
                                revision={a.revision}
                              />
                              <input type="hidden" name="kind" value={a.kind} />
                              <button
                                name="direction"
                                value="up"
                                aria-label={`Pomakni aktivnost gore: ${a.title}`}
                                className="rounded p-2 hover:bg-slate-200"
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                name="direction"
                                value="down"
                                aria-label={`Pomakni aktivnost dolje: ${a.title}`}
                                className="rounded p-2 hover:bg-slate-200"
                              >
                                <ArrowDown size={15} />
                              </button>
                              <a
                                href={href.toString()}
                                aria-label={`Uredi aktivnost: ${a.title}`}
                                className="rounded p-2 text-blue-700"
                              >
                                <Pencil size={15} />
                              </a>
                            </form>
                          )}
                        </div>
                        {a.kind === "material" &&
                          a.label === "Tekst i mediji" && (
                            <>
                              <RichContent
                                document={a.rich_body}
                                fallback={a.body}
                              />
                              <LearningAttachments
                                kind="material"
                                target={a.id}
                                files={files}
                                manage={false}
                                ready={data.filesReady}
                              />
                            </>
                          )}
                        {files.length > 0 && a.label !== "Tekst i mediji" && (
                          <p className="text-xs text-slate-500">
                            {files.map((f) => f.file_name).join(" · ")}
                          </p>
                        )}
                      </article>
                    );
                  })}
                  {editing && (
                    <div className="border-t border-slate-200 pt-4">
                      <ActivityChooser
                        base={base}
                        courseId={course.id}
                        sectionId={s?.id}
                        quizzesReady={data.quizzesReady}
                      />
                    </div>
                  )}
                </div>
              </details>
            </section>
          );
        })}
        {editing && (
          <details className="rounded-xl border border-dashed border-blue-300 bg-white p-5">
            <summary className="flex w-fit cursor-pointer items-center gap-2 font-semibold text-blue-700">
              <Plus size={18} />
              Dodaj cjelinu
            </summary>
            <div className="mt-4">
              <SectionEditor courseId={course.id} />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
