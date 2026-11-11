import { learningData } from "@/lib/learning/data";
import { identity } from "@/lib/auth/access";
import { learningErrors } from "@/lib/learning/validation";
import type {
  Assignment,
  Material,
  Submission,
  Section,
} from "@/lib/learning/model";
import { navigation } from "@/lib/context";
import { hrDate, zagrebInput } from "@/lib/academic/time";
import { serviceLoginUrl, moodleLoginUrl } from "@/lib/external-services";
import { inputClass } from "@/components/auth/forms";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/academic/shared";
import { LearningAttachments } from "./attachments";
import { LearningCreateForm } from "./create-form";
import { CourseCatalogue } from "./catalogue";
import {
  CourseHeader,
  CourseOverview,
  CourseDeadlines,
  CourseGradebook,
} from "./course-overview";
import { DashboardTimeline } from "./timeline";
import { CourseSections } from "./sections";
import { PlacementFields } from "./placement";
import { RichEditor } from "./rich-editor";
import { RichContent } from "./rich-content";
import { CourseQuizzes } from "./quizzes";
import { BookOpen, FileText, ClipboardList } from "lucide-react";

function MoodleAccess({ target }: { target: string | null }) {
  if (!target) return null;
  return (
    <details
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      aria-label="Moodle"
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-500">
        Vanjski Moodle na Gnomiju
      </summary>
      <p className="text-sm leading-6">
        Otvorite materijale, zadatke i kvizove na svojem Moodleu. Prijavite se
        korisničkim računom koji imate na toj stranici.
      </p>
      <Button asChild>
        <a href={target} target="_blank" rel="noopener noreferrer">
          Otvori Moodle
        </a>
      </Button>
      <p className="break-all text-xs text-slate-500">
        {new URL(target).hostname}
      </p>
    </details>
  );
}

function Field({
  name,
  title,
  value = "",
  type = "text",
  required = false,
  maxLength,
  min,
  max,
  step,
}: {
  name: string;
  title: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {title}
      <input
        className={inputClass}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}
function Text({
  name,
  title,
  value = "",
  maxLength = 20000,
  required = false,
}: {
  name: string;
  title: string;
  value?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {title}
      <textarea
        className={`${inputClass} min-h-32`}
        name={name}
        defaultValue={value}
        maxLength={maxLength}
        required={required}
      />
    </label>
  );
}
function Check({
  name,
  children,
  checked,
}: {
  name: string;
  children: React.ReactNode;
  checked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        className="mt-1"
        type="checkbox"
        name={name}
        defaultChecked={checked}
      />
      {children}
    </label>
  );
}
function Hidden({
  course,
  view,
  revision = 0,
}: {
  course: string;
  view: string;
  revision?: number;
}) {
  return (
    <>
      <input type="hidden" name="course_id" value={course} />
      <input type="hidden" name="return_view" value={view} />
      <input type="hidden" name="revision" value={revision} />
    </>
  );
}
function Resource({ url, label }: { url: string; label: string }) {
  const target = serviceLoginUrl(url);
  return target ? (
    <a
      className="inline-block break-all text-sm text-blue-700 underline"
      href={target}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label} ({new URL(target).hostname})
    </a>
  ) : null;
}
function MaterialForm({
  course,
  material,
  filesReady,
  sections = [],
  sectionsReady = false,
  sectionId,
  resourceKind = "text",
}: {
  sections?: Section[];
  sectionsReady?: boolean;
  sectionId?: string;
  resourceKind?: Material["resource_kind"];
  course: string;
  material?: Material;
  filesReady: boolean;
}) {
  return (
    <LearningCreateForm
      kind="material"
      filesReady={filesReady}
      existing={!!material}
    >
      <Hidden course={course} view="Materijali" revision={material?.revision} />
      <input type="hidden" name="id" value={material?.id || ""} />
      <Field
        name="title"
        title="Naslov materijala"
        value={material?.title}
        required
        maxLength={200}
      />
      <PlacementFields
        sections={sections}
        sectionId={material?.section_id ?? sectionId}
        enabled={sectionsReady}
      />
      {sectionsReady && (
        <label className="block text-sm font-medium">
          Vrsta resursa
          <select
            name="resource_kind"
            defaultValue={material?.resource_kind || resourceKind}
            className={inputClass}
          >
            <option value="text">Tekst i mediji</option>
            <option value="page">Stranica</option>
            <option value="file">Datoteka</option>
            <option value="folder">Mapa</option>
            <option value="url">Poveznica</option>
          </select>
        </label>
      )}
      {sectionsReady ? (
        <RichEditor
          name="body"
          label="Tekst materijala"
          value={material?.body}
          document={material?.rich_body}
        />
      ) : (
        <Text name="body" title="Tekst materijala" value={material?.body} />
      )}
      <Field
        name="resource_url"
        title="HTTPS poveznica na dokument ili video (neobvezno)"
        type="url"
        value={material?.resource_url}
        maxLength={2048}
      />
      <p className="text-xs text-slate-500">
        Unesite tekst, odaberite datoteke ili dodajte vanjsku HTTPS poveznicu.
      </p>
      <Check name="published" checked={material?.published}>
        Objavljeno studentima
      </Check>
    </LearningCreateForm>
  );
}
function AssignmentForm({
  course,
  assignment,
  filesReady,
  sections = [],
  sectionsReady = false,
  sectionId,
}: {
  sections?: Section[];
  sectionsReady?: boolean;
  sectionId?: string;
  course: string;
  assignment?: Assignment;
  filesReady: boolean;
}) {
  return (
    <LearningCreateForm
      kind="assignment"
      filesReady={filesReady}
      existing={!!assignment}
    >
      <Hidden course={course} view="Zadaci" revision={assignment?.revision} />
      <input type="hidden" name="id" value={assignment?.id || ""} />
      <Field
        name="title"
        title="Naslov zadatka"
        value={assignment?.title}
        required
        maxLength={200}
      />
      <PlacementFields
        sections={sections}
        sectionId={assignment?.section_id ?? sectionId}
        enabled={sectionsReady}
      />
      {sectionsReady ? (
        <RichEditor
          name="instructions"
          label="Upute za izradu"
          value={assignment?.instructions}
          document={assignment?.rich_body}
        />
      ) : (
        <Text
          name="instructions"
          title="Upute za izradu"
          value={assignment?.instructions}
          required
        />
      )}
      <Field
        name="due_at"
        title="Rok predaje (hrvatsko vrijeme; prazno znači bez roka)"
        type="datetime-local"
        value={assignment?.due_at ? zagrebInput(assignment.due_at) : ""}
      />
      <Field
        name="max_points"
        title="Maksimalan broj bodova"
        type="number"
        value={assignment?.max_points ?? 100}
        required
        min={0.01}
        max={10000}
        step="0.01"
      />
      <Check name="allow_late" checked={assignment?.allow_late}>
        Dopusti predaju i nakon roka
      </Check>
      <Check name="published" checked={assignment?.published}>
        Objavljeno studentima
      </Check>
    </LearningCreateForm>
  );
}
function SubmissionDetails({ submission }: { submission: Submission }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Predano {hrDate(submission.submitted_at)}
      </p>
      <p className="whitespace-pre-wrap break-words text-sm">
        {submission.body}
      </p>
      <Resource url={submission.resource_url} label="Otvori predani rad" />
      {submission.graded_at && (
        <div className="rounded-lg bg-blue-50 p-4 text-sm">
          <p className="font-semibold">Bodovi: {submission.score}</p>
          <p className="mt-2 whitespace-pre-wrap break-words">
            {submission.feedback || "Nema dodatne povratne informacije."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Vrednovano {hrDate(submission.graded_at)}
          </p>
        </div>
      )}
    </div>
  );
}

export async function LearningWorkspace({
  courseId,
  institution,
  view,
  status,
  edit = false,
  create,
  section,
}: {
  edit?: boolean;
  create?: string;
  section?: string;
  courseId?: string;
  institution?: string;
  view: string;
  status?: string;
}) {
  const moodle = moodleLoginUrl(process.env.MERLIN_LMS_URL);
  const data = await learningData(courseId, institution);
  const url = await navigation();
  if (!data) {
    const administrator = (await identity())?.superadmin;
    return (
      <div className="space-y-6">
        <MoodleAccess target={moodle} />
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          {administrator ? (
            <>
              E-učenje još nije uključeno. Primijenite migraciju{" "}
              <code>202611090002_native_learning.sql</code>.
            </>
          ) : (
            "E-učenje trenutačno nije dostupno. Obratite se administratoru ustanove."
          )}
        </p>
      </div>
    );
  }
  const {
    courses,
    course,
    materials,
    assignments,
    submissions,
    account,
    profiles,
    files,
    filesReady,
  } = data;
  const editing = !!(course?.can_manage && edit);
  const sectionId = data.sections.some((s) => s.id === section)
    ? section
    : undefined;
  const placement = {
    sections: data.sections,
    sectionsReady: data.sectionsReady,
    sectionId,
  };
  const base = new URL(url("merlin"));
  if (institution || course?.institution_id)
    base.searchParams.set("institution", institution || course!.institution_id);
  if (editing) base.searchParams.set("edit", "1");
  return (
    <div className="space-y-8">
      {status && (
        <p
          role={status === "saved" ? "status" : "alert"}
          className={`rounded-lg p-4 text-sm ${status === "saved" ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-900"}`}
        >
          {status === "saved"
            ? "Promjena je spremljena."
            : learningErrors[status] || learningErrors.invalid}
        </p>
      )}
      {!course && (
        <>
          <section>
            <p className="text-sm text-slate-500">Osobna stranica</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Dobro došli
              {account.profile.full_name
                ? `, ${account.profile.full_name.split(" ")[0]}`
                : ""}
              .
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Vaši kolegiji, nastavni sadržaji i rokovi na jednom mjestu.
            </p>
          </section>
          <CourseCatalogue
            courses={courses}
            base={base.toString()}
            userId={account.user.id}
          />
          <DashboardTimeline
            events={data.dashboardEvents}
            base={base.toString()}
          />
        </>
      )}
      {course && (
        <>
          <CourseHeader
            data={data}
            base={base.toString()}
            view={view}
            editing={editing}
          />
          {view === "Moji kolegiji" &&
            (data.sectionsReady ? (
              <CourseSections
                data={data}
                base={base.toString()}
                editing={editing}
              />
            ) : (
              <>
                <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                  {course.can_manage
                    ? "Za cjeline i uređivanje primijenite migraciju 202611100002_learning_sections.sql."
                    : "Sadržaj kolegija dostupan je u karticama Materijali, Zadaci i Kvizovi."}
                </p>
                <CourseOverview data={data} base={base.toString()} />
              </>
            ))}
          {view === "Kvizovi" && (
            <CourseQuizzes
              data={data}
              editing={editing}
              create={create === "quiz"}
              sectionId={sectionId}
            />
          )}
          {view === "Bodovi" && <CourseGradebook data={data} />}
          {view === "Rokovi" && (
            <CourseDeadlines data={data} base={base.toString()} />
          )}
          {view === "Materijali" && (
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-blue-100 p-3 text-blue-700">
                  <FileText size={22} />
                </span>
                <div>
                  <h2 className="text-2xl font-bold">Materijali</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Dokumenti, prezentacije i video vašeg kolegija.
                  </p>
                </div>
              </div>
              {editing && (
                <details
                  open={
                    !!create &&
                    ["text", "page", "file", "folder", "url"].includes(create)
                  }
                  className="rounded-2xl border border-dashed border-blue-300 bg-white p-6"
                >
                  <summary className="cursor-pointer font-semibold">
                    Dodaj materijal
                  </summary>
                  <div className="mt-5">
                    <MaterialForm
                      course={course.id}
                      filesReady={filesReady}
                      {...placement}
                      resourceKind={
                        ["page", "file", "folder", "url"].includes(create || "")
                          ? (create as Material["resource_kind"])
                          : "text"
                      }
                    />
                  </div>
                </details>
              )}
              {!materials.length && (
                <Empty>
                  Još nema {course.can_manage ? "" : "objavljenih "}materijala.
                </Empty>
              )}
              {materials.map((m) => (
                <article
                  key={m.id}
                  id={m.id}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold">
                    {m.title}{" "}
                    {!m.published && (
                      <span className="text-sm font-normal text-amber-800">
                        · Nacrt
                      </span>
                    )}
                  </h3>
                  <RichContent document={m.rich_body} fallback={m.body} />
                  <Resource url={m.resource_url} label="Otvori materijal" />
                  <LearningAttachments
                    kind="material"
                    target={m.id}
                    files={files.filter((f) => f.material_id === m.id)}
                    manage={editing}
                    ready={filesReady}
                  />
                  <p className="text-xs text-slate-500">
                    Ažurirano {hrDate(m.updated_at)}
                  </p>
                  {editing && (
                    <details>
                      <summary className="cursor-pointer text-sm text-blue-700">
                        Uredi materijal
                      </summary>
                      <div className="mt-4">
                        <MaterialForm
                          course={course.id}
                          material={m}
                          {...placement}
                          filesReady={filesReady}
                        />
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </section>
          )}
          {["Zadaci", "Predaje"].includes(view) && (
            <section className="space-y-5">
              <h2 className="flex items-center gap-3 text-2xl font-bold">
                <ClipboardList size={25} className="text-orange-600" />
                {view === "Predaje"
                  ? "Predaje i povratne informacije"
                  : "Zadaci"}
              </h2>
              <p className="text-sm text-slate-500">
                Bodovi zadataka služe praćenju rada. Službena ocjena ispita
                evidentira se zasebno u ispitnoj evidenciji.
              </p>
              {editing && view !== "Predaje" && (
                <details
                  open={create === "assignment"}
                  className="rounded-2xl border border-dashed border-blue-300 bg-white p-6"
                >
                  <summary className="cursor-pointer font-semibold">
                    Dodaj zadatak
                  </summary>
                  <div className="mt-5">
                    <AssignmentForm
                      course={course.id}
                      {...placement}
                      filesReady={filesReady}
                    />
                  </div>
                </details>
              )}
              {!assignments.length && (
                <Empty>
                  Još nema {course.can_manage ? "" : "objavljenih "}zadataka.
                </Empty>
              )}
              {assignments.map((a) => {
                const submitted = submissions.filter(
                  (s) => s.assignment_id === a.id,
                );
                const own = submitted.find(
                  (s) => s.student_id === account.user.id,
                );
                const late =
                  !!a.due_at && new Date(a.due_at).getTime() < Date.now();
                const open = a.published && (!late || a.allow_late);
                return (
                  <article
                    key={a.id}
                    id={a.id}
                    className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <h3 className="text-lg font-semibold">
                      {a.title}{" "}
                      {!a.published && (
                        <span className="text-sm font-normal text-amber-800">
                          · Nacrt
                        </span>
                      )}
                    </h3>
                    <RichContent
                      document={a.rich_body}
                      fallback={a.instructions}
                    />
                    <p className="text-sm text-slate-500">
                      Najviše {a.max_points} bodova ·{" "}
                      {a.due_at ? `Rok: ${hrDate(a.due_at)}` : "Bez roka"}
                      {a.allow_late ? " · Dopuštene zakašnjele predaje" : ""}
                    </p>
                    {editing && view !== "Predaje" && (
                      <details>
                        <summary className="cursor-pointer text-sm text-blue-700">
                          Uredi zadatak
                        </summary>
                        <div className="mt-4">
                          <AssignmentForm
                            course={course.id}
                            assignment={a}
                            {...placement}
                            filesReady={filesReady}
                          />
                        </div>
                      </details>
                    )}
                    <LearningAttachments
                      kind="assignment"
                      target={a.id}
                      files={files.filter((f) => f.assignment_id === a.id)}
                      manage={editing}
                      ready={filesReady}
                    />
                    {course.can_submit && (
                      <section className="space-y-4 border-t border-slate-200 pt-4">
                        <h4 className="font-semibold">Moja predaja</h4>
                        {own ? (
                          <SubmissionDetails submission={own} />
                        ) : (
                          <p className="text-sm text-slate-500">
                            Još niste predali rad.
                          </p>
                        )}
                        {own?.graded_at ? (
                          <p className="text-sm text-slate-500">
                            Vrednovana predaja je zaključana.
                          </p>
                        ) : open ? (
                          <form
                            method="post"
                            action="/api/learning/submit"
                            className="space-y-4"
                          >
                            <Hidden
                              course={course.id}
                              view="Zadaci"
                              revision={own?.revision}
                            />
                            <input
                              type="hidden"
                              name="assignment_id"
                              value={a.id}
                            />
                            <Text
                              name="body"
                              title="Odgovor / tekst rada"
                              value={own?.body}
                            />
                            <Field
                              name="resource_url"
                              title="HTTPS poveznica na rad (neobvezno)"
                              type="url"
                              value={own?.resource_url}
                              maxLength={2048}
                            />
                            <p className="text-xs text-slate-500">
                              Unesite tekst ili poveznicu. Poveznica treba
                              dopustiti nastavniku pristup radu. Do vrednovanja
                              i isteka roka možete zamijeniti svoju predaju.
                            </p>
                            {late && (
                              <p className="text-sm text-amber-800">
                                Predaja će biti evidentirana nakon roka.
                              </p>
                            )}
                            <Button type="submit">
                              {own ? "Zamijeni predaju" : "Predaj rad"}
                            </Button>
                          </form>
                        ) : (
                          <p className="text-sm text-amber-800">
                            Predaja je zatvorena.
                          </p>
                        )}
                      </section>
                    )}
                    {course.can_manage && (
                      <section className="space-y-5 border-t border-slate-200 pt-4">
                        <h4 className="font-semibold">
                          Studentske predaje ({submitted.length})
                        </h4>
                        {!submitted.length && (
                          <p className="text-sm text-slate-500">
                            Još nema predaja.
                          </p>
                        )}
                        {submitted.map((s) => (
                          <details
                            key={s.id}
                            className="rounded-lg border border-slate-200 p-4"
                          >
                            <summary className="cursor-pointer text-sm font-semibold">
                              {profiles.find((p) => p.id === s.student_id)
                                ?.full_name || "Student"}{" "}
                              ·{" "}
                              {s.graded_at
                                ? `${s.score}/${a.max_points} bodova`
                                : "Čeka vrednovanje"}
                              {a.due_at &&
                              new Date(s.submitted_at) > new Date(a.due_at)
                                ? " · Nakon roka"
                                : ""}
                            </summary>
                            <div className="mt-4 space-y-5">
                              <SubmissionDetails submission={s} />
                              <form
                                action="/api/learning/grade"
                                method="post"
                                className="space-y-4"
                              >
                                <Hidden
                                  course={course.id}
                                  view="Predaje"
                                  revision={s.revision}
                                />
                                <input
                                  type="hidden"
                                  name="submission_id"
                                  value={s.id}
                                />
                                <Field
                                  name="score"
                                  title={`Bodovi (0–${a.max_points})`}
                                  type="number"
                                  value={s.score ?? ""}
                                  min={0}
                                  max={a.max_points}
                                  step="0.01"
                                  required
                                />
                                <Text
                                  name="feedback"
                                  title="Povratna informacija studentu"
                                  value={s.feedback}
                                  maxLength={5000}
                                />
                                <Button type="submit">
                                  Spremi bodove i povratnu informaciju
                                </Button>
                              </form>
                            </div>
                          </details>
                        ))}
                      </section>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
      <MoodleAccess target={moodle} />
    </div>
  );
}
