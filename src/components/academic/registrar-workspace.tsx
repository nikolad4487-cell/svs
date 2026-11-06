import type { AcademicData } from "@/lib/academic/data";
import { navigation } from "@/lib/context";
import { inputClass, Submit } from "@/components/auth/forms";
import { PendingCredentials } from "@/components/auth/pending-credentials";
import { AdmissionImport } from "@/components/auth/admission-import";
import { AcademicAdmin } from "./admin";
import { EnrollmentCompletion } from "./enrollment-completion";
import { StudentServicesAdmin } from "./student-services";
import { Section, Table, person, courseName } from "./shared";
import { RegistrarCaseForm } from "./registrar-case-form";
import {
  enrollmentKinds,
  caseStates,
  annualFields,
  type EnrollmentCase,
} from "@/lib/academic/registrar";
import { hrDate } from "@/lib/academic/time";
function Hidden({
  data,
  view,
  record,
  student,
}: {
  data: AcademicData;
  view: string;
  record?: EnrollmentCase;
  student?: string;
}) {
  return (
    <>
      <input type="hidden" name="institution_id" value={data.institution.id} />
      <input type="hidden" name="return_view" value={view} />
      {student && <input type="hidden" name="return_student" value={student} />}
      {record && (
        <>
          <input type="hidden" name="case_id" value={record.id} />
          <input
            type="hidden"
            name="expected_revision"
            value={record.revision}
          />
        </>
      )}
    </>
  );
}
function StudentAccounts({ data }: { data: AcademicData }) {
  return (
    <Section title="Novi studentski račun i početni pristup">
      <p className="text-sm text-slate-600">
        Za studenta koji ne dolazi uvozom iz e-Matice najprije otvorite
        studentski poziv na vlastitoj domeni ustanove. Zatim izdajte i ispišite
        početne podatke bez slanja e-pošte. Referada ovdje može stvarati
        isključivo studentske račune.
      </p>
      <form action="/api/registrar/invite" method="post" className="space-y-4">
        <Hidden data={data} view="Upisni postupci" />
        <label className="block text-sm">
          Korisničko ime / e-adresa na domeni ustanove
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            className={inputClass}
          />
        </label>
        <p className="text-xs text-slate-500">
          Dopuštene domene:{" "}
          {data.institution.email_domains?.join(", ") ||
            "Administrator još nije postavio domenu"}
          . Otvaranje poziva ne šalje poruku. Postojeći potvrđeni račun zadržava
          lozinku.
        </p>
        <Submit>Otvori studentski poziv</Submit>
      </form>
      {data.studentInvites.map((v) => (
        <details key={v.id} className="rounded-lg border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">
            {v.email} ·{" "}
            {v.credentials_issued_at
              ? "Izdavanje je već rezervirano"
              : "Čeka izdavanje pristupa"}
          </summary>
          {!v.credentials_issued_at ? (
            <PendingCredentials inviteId={v.id} />
          ) : (
            <p className="mt-3 text-sm">
              Početni podaci već su rezervirani. Provjerite stanje računa prije
              novog pokušaja.
            </p>
          )}
        </details>
      ))}
      <p className="text-xs text-slate-500">
        Nakon ispisa ili spremanja početnih podataka osvježite stranicu kako
        biste novi studentski račun odabrali u upisnom postupku.
      </p>
    </Section>
  );
}
function Reason() {
  return (
    <label className="block text-sm">
      Obrazloženje / oznaka provedene provjere
      <textarea
        name="reason"
        required
        minLength={10}
        maxLength={1000}
        className={inputClass}
      />
    </label>
  );
}
export async function RegistrarWorkspace({
  data,
  view,
  studentId,
}: {
  data: AcademicData;
  view: string;
  studentId?: string;
}) {
  if (!data.manager)
    return (
      <p>
        Za rad u referadi potrebna je ovlast referade ili administratora
        odabrane ustanove.
      </p>
    );
  const url = await navigation(),
    base = url("referada");
  const link = (v: string) =>
    `${base}${base.includes("?") ? "&" : "?"}institution=${data.institution.id}&view=${encodeURIComponent(v)}`;
  if (view === "Uvoz upisa")
    return (
      <div className="space-y-6">
        <p className="rounded-lg bg-blue-50 p-4 text-sm">
          Referada provjerava dokaze i provodi prvi upis. Podaci iz e-Matice
          samo se čitaju. Nakon preuzimanja sastavite i provjerite upisni list u
          ovom modulu.
        </p>
        <AdmissionImport />
      </div>
    );
  if (view === "Studenti i upisi")
    return (
      <div className="space-y-10">
        <p className="text-sm">
          Ovdje uređujete godišnje upisne listove i potvrđujete dovršenost. Za
          novi postupak s vrstom upisa i odlukom otvorite{" "}
          <a className="text-blue-700 underline" href={link("Upisni postupci")}>
            Upisne postupke
          </a>
          .
        </p>
        <AcademicAdmin
          data={data}
          module="referada"
          view={view}
          actions={["study", "enrollment"]}
        />
        <EnrollmentCompletion data={data} module="referada" view={view} />
      </div>
    );
  if (view === "Studentske evidencije")
    return <StudentServicesAdmin data={data} module="referada" />;
  if (view === "Grupe studenata")
    return (
      <div className="space-y-10">
        <AcademicAdmin
          data={data}
          module="referada"
          view={view}
          actions={["group", "group-member"]}
        />
        <Section title="Popisi grupa">
          <Table
            headings={["Kolegij", "Grupa", "Studenti"]}
            rows={data.groups.map((g) => [
              courseName(data, g.course_id),
              g.name,
              data.groupMembers
                .filter((m) => m.group_id === g.id)
                .map((m) => person(data, m.student_id))
                .join(", ") || "Nema raspoređenih studenata",
            ])}
          />
        </Section>
      </div>
    );
  if (!data.registrarReady)
    return (
      <p role="alert" className="rounded-lg bg-amber-50 p-5 text-sm">
        Za dosjee, službene godišnje podatke i vrste upisnih postupaka
        primijenite migraciju 202611060005_registrar_workbench.sql. Postojeće
        godišnje upise i studentske evidencije možete otvoriti iz izbornika.
      </p>
    );
  const students = [
    ...new Set(
      data.members.filter((m) => m.role === "student").map((m) => m.user_id),
    ),
  ]
    .map((id) => {
      const auth = data.studentRoster.find((r) => r.id === id),
        record = data.studentRecords.find((r) => r.student_id === id);
      return {
        id,
        name: [
          record?.legal_name || auth?.full_name || person(data, id),
          auth?.email,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "hr"));
  if (view === "Studenti i dosjei") {
    const selected = students.find((s) => s.id === studentId) || students[0];
    if (!selected)
      return (
        <p>
          Ustanova još nema studentskih računa. Za učenike iz e-Matice otvorite
          Uvoz upisa; ostale studente otvorite preko Studentskog poziva u
          Upisnim postupcima.
        </p>
      );
    const student = selected.id,
      record = data.studentRecords.find((r) => r.student_id === student);
    const studies = data.studies.filter((s) => s.student_id === student);
    const years = data.years.filter((y) =>
      studies.some((s) => s.academic_year_id === y.id),
    );
    return (
      <div className="space-y-10">
        <Section title="Studentski dosje">
          <form
            method="get"
            action={base.split("?")[0]}
            className="flex flex-wrap items-end gap-4"
          >
            <input type="hidden" name="module" value="referada" />
            <input type="hidden" name="view" value={view} />
            <input
              type="hidden"
              name="institution"
              value={data.institution.id}
            />
            <label className="text-sm">
              Pretraži / odaberi studenta
              <select
                name="student"
                defaultValue={student}
                className={inputClass}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ·{" "}
                    {data.studentRecords.find((r) => r.student_id === s.id)
                      ?.local_number || "Novi dosje"}
                  </option>
                ))}
              </select>
            </label>
            <Submit>Prikaži dosje</Submit>
          </form>
          <p className="text-sm">
            Lokalni broj:{" "}
            <strong>
              {record?.local_number || "Dodjeljuje se pri spremanju dosjea"}
            </strong>
            . Upisni broj kandidata, lokalni broj i JMBAG vode se odvojeno.
          </p>
          <form
            method="post"
            action="/api/registrar/record"
            className="grid gap-4 sm:grid-cols-2"
          >
            <Hidden data={data} view={view} student={student} />
            <input type="hidden" name="student_id" value={student} />
            <input
              type="hidden"
              name="expected_revision"
              value={record?.revision || 0}
            />
            <label className="text-sm">
              Službeno ime i prezime
              <input
                name="legal_name"
                required
                minLength={2}
                maxLength={200}
                defaultValue={
                  record?.legal_name ||
                  data.studentRoster.find((r) => r.id === student)?.full_name ||
                  ""
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Datum rođenja
              <input
                name="birth_date"
                type="date"
                defaultValue={record?.birth_date || ""}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Državljanstvo
              <input
                name="citizenship"
                maxLength={100}
                defaultValue={record?.citizenship}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Postojeći službeni JMBAG (nije obvezan)
              <input
                name="jmbag"
                inputMode="numeric"
                pattern="[0-9]{10}"
                defaultValue={record?.jmbag}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              OIB (nije obvezan)
              <input
                name="oib"
                inputMode="numeric"
                pattern="[0-9]{11}"
                defaultValue={record?.oib}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Izvor provjere identifikatora
              <input
                name="identity_reference"
                maxLength={300}
                defaultValue={record?.identity_reference}
                className={inputClass}
              />
            </label>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Službene identifikatore unosite samo iz provjerenog dokumenta.
              Aplikacija dodjeljuje vlastiti lokalni broj i ne stvara službeni
              JMBAG.
            </p>
            <div className="sm:col-span-2">
              <Submit>Spremi matične podatke</Submit>
            </div>
          </form>
        </Section>
        <Section title="Studiji i godišnji upisi">
          <Table
            headings={[
              "Program",
              "Akademska godina",
              "Godina studija",
              "Status upisa",
            ]}
            rows={studies.map((s) => [
              data.programs.find((p) => p.id === s.program_id)?.name,
              data.years.find((y) => y.id === s.academic_year_id)?.name,
              s.study_year,
              s.completion_status || "Nije verificirano",
            ])}
          />
        </Section>
        <Section title="Student u akademskoj godini">
          <p className="text-sm text-slate-500">
            Službene podatke prebivališta i datum potvrde evidentira referada.
            Studentova ranija samoprijava ostaje odvojena i ne smatra se
            provjerenim službenim podatkom.
          </p>
          {years.map((y) => {
            const annual = data.studentYearRecords.find(
              (r) => r.student_id === student && r.academic_year_id === y.id,
            );
            return (
              <details
                key={y.id}
                className="rounded-lg border border-slate-200 p-5"
              >
                <summary className="cursor-pointer font-semibold">
                  {y.name}
                </summary>
                <form
                  method="post"
                  action="/api/registrar/year"
                  className="mt-5 grid gap-4 sm:grid-cols-2"
                >
                  <Hidden data={data} view={view} student={student} />
                  <input type="hidden" name="student_id" value={student} />
                  <input type="hidden" name="academic_year_id" value={y.id} />
                  <input
                    type="hidden"
                    name="expected_revision"
                    value={annual?.revision || 0}
                  />
                  {annualFields.map(([name, label]) => (
                    <label key={name} className="text-sm">
                      {label}
                      <input
                        name={name}
                        type={
                          name === "residence_confirmation_date"
                            ? "date"
                            : "text"
                        }
                        maxLength={300}
                        defaultValue={annual?.details[name] || ""}
                        className={inputClass}
                      />
                    </label>
                  ))}
                  <div className="sm:col-span-2">
                    <Submit>Spremi službene godišnje podatke</Submit>
                  </div>
                </form>
              </details>
            );
          })}
          {!years.length && (
            <p>Godišnji podaci dostupni su nakon izrade prvog upisnog lista.</p>
          )}
        </Section>
        <Section title="Povezani upisni postupci">
          <Table
            headings={["Vrsta", "Godina", "Status", "Odluka"]}
            rows={data.enrollmentCases
              .filter((r) => r.student_id === student)
              .map((r) => [
                enrollmentKinds[r.kind],
                data.years.find((y) => y.id === r.academic_year_id)?.name,
                caseStates[r.state],
                r.decision_reference,
              ])}
          />
        </Section>
      </div>
    );
  }
  if (view === "Upisni postupci")
    return (
      <div className="space-y-10">
        <StudentAccounts data={data} />
        <Section title="Novi upisni postupak referade">
          <p className="text-sm text-slate-600">
            Sve vrste upisa provodi referada. Najprije otvorite postupak, zatim
            provjerite dokaze i uvjete, izradite upisni list s kolegijima i
            konačno potvrdite dovršenost. Za novu osobu bez računa najprije
            koristite Uvoz upisa ili studentski poziv referade.
          </p>
          <details className="rounded-xl border border-slate-200 p-5">
            <summary className="cursor-pointer font-semibold text-blue-700">
              Otvori novi postupak
            </summary>
            <div className="mt-5">
              <RegistrarCaseForm
                institution={data.institution.id}
                students={students}
                programs={data.programs}
                years={data.years}
                studies={data.studies}
              />
            </div>
          </details>
        </Section>
        <Section title="Postupci u obradi">
          {!data.enrollmentCases.length && (
            <p>Nema upisnih postupaka za odabranu ustanovu.</p>
          )}
          {data.enrollmentCases.map((r) => {
            const courses = data.courses.filter(
              (c) =>
                c.program_id === r.program_id &&
                data.semesters.find((s) => s.id === c.semester_id)
                  ?.academic_year_id === r.academic_year_id,
            );
            return (
              <details
                key={r.id}
                className="rounded-xl border border-slate-200 p-5"
              >
                <summary className="cursor-pointer font-semibold">
                  {person(data, r.student_id)} ·{" "}
                  {data.programs.find((p) => p.id === r.program_id)?.name} ·{" "}
                  {enrollmentKinds[r.kind]} ·{" "}
                  {data.years.find((y) => y.id === r.academic_year_id)?.name} ·{" "}
                  {caseStates[r.state]}
                </summary>
                <div className="mt-5 space-y-6">
                  <p className="text-sm">
                    {data.programs.find((p) => p.id === r.program_id)?.name} ·{" "}
                    {r.study_year}. godina ·{" "}
                    {r.mode === "full_time" ? "Redoviti" : "Izvanredni"} ·{" "}
                    {r.financing}
                    <br />
                    Upisni broj: {r.admission_number || "Nije evidentiran"} ·
                    Odluka: {r.decision_reference}
                  </p>
                  {r.state === "draft" && (
                    <>
                      <details>
                        <summary className="cursor-pointer text-blue-700">
                          Uredi pripremu
                        </summary>
                        <div className="mt-5">
                          <RegistrarCaseForm
                            institution={data.institution.id}
                            students={students}
                            programs={data.programs}
                            years={data.years}
                            studies={data.studies}
                            record={r}
                          />
                        </div>
                      </details>
                      <form
                        method="post"
                        action="/api/registrar/decision"
                        className="space-y-4"
                      >
                        <Hidden data={data} view={view} record={r} />
                        <input
                          type="hidden"
                          name="next_state"
                          value="approved"
                        />
                        <fieldset className="space-y-3">
                          <legend className="mb-3 font-semibold">
                            Provjera prava upisa
                          </legend>
                          {[
                            [
                              "documents_verified",
                              "Dokumenti i identitet provjereni",
                            ],
                            [
                              "conditions_verified",
                              "Uvjeti programa, prethodni upis i odluka provjereni",
                            ],
                            ...(r.kind === "first_matura"
                              ? [
                                  [
                                    "matura_verified",
                                    "Položena matura provjerena prema rezultatu / dokazu",
                                  ],
                                ]
                              : []),
                            ...(["postgraduate", "first_selection"].includes(
                              r.kind,
                            )
                              ? [
                                  [
                                    "qualification_verified",
                                    "Prethodna kvalifikacija za studij provjerena",
                                  ],
                                ]
                              : []),
                          ].map(([name, label]) => (
                            <label
                              className="flex items-start gap-3 text-sm"
                              key={name}
                            >
                              <input
                                type="checkbox"
                                name={name}
                                required
                                className="mt-1"
                              />
                              {label}
                            </label>
                          ))}
                        </fieldset>
                        <Reason />
                        <Submit>Odobri izradu upisnog lista</Submit>
                      </form>
                    </>
                  )}
                  {r.state === "approved" && (
                    <form
                      method="post"
                      action="/api/registrar/enroll"
                      className="space-y-4"
                    >
                      <Hidden data={data} view={view} record={r} />
                      <fieldset className="space-y-3">
                        <legend className="mb-3 font-semibold">
                          Upisni list: obvezni i izborni kolegiji
                        </legend>
                        {courses.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-start gap-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              name="course_id"
                              value={c.id}
                              defaultChecked={!c.elective_group}
                              className="mt-1"
                            />
                            {c.code} · {c.name} · {c.ects} ECTS
                            {c.elective_group
                              ? ` · izborna grupa: ${c.elective_group}`
                              : ""}
                          </label>
                        ))}
                      </fieldset>
                      {!courses.length && (
                        <p className="text-amber-800">
                          Nema kolegija za odabrani program i godinu. Najprije
                          pripremite katalog.
                        </p>
                      )}
                      <Reason />
                      <Submit>Izradi upisni list</Submit>
                    </form>
                  )}
                  {r.state === "enrolled" && (
                    <p className="rounded-lg bg-blue-50 p-4 text-sm">
                      Upisni list je izrađen.{" "}
                      <a
                        href={link("Studenti i upisi")}
                        className="font-semibold text-blue-700 underline"
                      >
                        Provjeri i dovrši godišnji upis
                      </a>
                      . Prijava ispita ostaje blokirana do dovršenja.
                    </p>
                  )}
                  {r.state !== "enrolled" && (
                    <form
                      method="post"
                      action="/api/registrar/decision"
                      className="space-y-4"
                    >
                      <Hidden data={data} view={view} record={r} />
                      <label className="text-sm">
                        Administrativna radnja
                        <select name="next_state" className={inputClass}>
                          {r.state !== "draft" && (
                            <option value="draft">Vrati u pripremu</option>
                          )}
                          {r.state !== "cancelled" && (
                            <option value="cancelled">Poništi postupak</option>
                          )}
                        </select>
                      </label>
                      <Reason />
                      <Submit>Spremi administrativnu radnju</Submit>
                    </form>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold">
                      Povijest postupka
                    </summary>
                    <ol className="mt-3 space-y-3 text-sm">
                      {data.registrarEvents
                        .filter((e) => e.case_id === r.id)
                        .sort((a, b) =>
                          a.occurred_at.localeCompare(b.occurred_at),
                        )
                        .map((e) => (
                          <li key={e.id}>
                            {hrDate(e.occurred_at)} · {person(data, e.actor_id)}{" "}
                            ·{" "}
                            {(
                              {
                                created: "Otvoren postupak",
                                edited: "Uređena priprema",
                                ...caseStates,
                              } as Record<string, string>
                            )[e.action] || e.action}
                            <p className="whitespace-pre-wrap text-slate-600">
                              {e.reason}
                            </p>
                          </li>
                        ))}
                    </ol>
                  </details>
                </div>
              </details>
            );
          })}
        </Section>
      </div>
    );
  return (
    <Section title="Radni prostor referade">
      <p className="text-sm text-slate-600">
        Referada provodi sve vrste upisa te vodi matične, godišnje i ostale
        studentske evidencije. Studenti u Studomatu pregledavaju svoje upise i
        koriste dopuštene studentske usluge.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          [
            "Upisni postupci",
            `${data.enrollmentCases.filter((r) => r.state === "draft" || r.state === "approved").length} u obradi`,
          ],
          ["Uvoz upisa", "Prvi upis učenika iz e-Matice"],
          ["Studenti i dosjei", `${students.length} studentskih računa`],
          [
            "Studenti i upisi",
            `${data.studies.filter((s) => !["completed", "cancelled"].includes(s.completion_status || "")).length} upisa za provjeru`,
          ],
          [
            "Studentske evidencije",
            "Školarine, prehrana, mobilnosti, prisustvo i potvrde",
          ],
          ["Grupe studenata", `${data.groups.length} nastavnih grupa`],
        ].map(([name, description]) => (
          <a
            key={name}
            href={link(name)}
            className="rounded-xl border border-slate-200 p-5 hover:bg-blue-50"
          >
            <strong className="text-blue-700">{name}</strong>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </a>
        ))}
      </div>
    </Section>
  );
}
