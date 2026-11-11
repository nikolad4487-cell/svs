import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Mail,
  UserRound,
} from "lucide-react";
import { isspData, type IsspData } from "@/lib/issp/data";
import {
  euro,
  financialSummary,
  recordDefinitions,
  workCriteria,
  diningCriteria,
  isspErrors,
  type RecordKind,
  type Field,
  zagrebDay,
  diningRightsActive,
} from "@/lib/issp/model";
import { studentProgress } from "@/lib/academic/student-progress";
import { hrDate } from "@/lib/academic/time";
import { navigation } from "@/lib/context";
import { ThemeToggle } from "@/components/theme-toggle";
import { StudentPortrait } from "./portrait";
import { IsspAdmin, PreferencesForm } from "./forms";
const input = "mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm";
export function IsspSection({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <details open id={id} className="issp-section scroll-mt-20">
      <summary className="flex cursor-pointer items-center gap-2 rounded-sm bg-[#e1e6a1] px-5 py-4 text-sm font-bold uppercase text-[#252a25]">
        <ChevronRight size={18} className="shrink-0" />
        {title}
      </summary>
      <div className="py-6">{children}</div>
    </details>
  );
}
export function IsspTable({
  headings,
  rows,
  caption,
}: {
  headings: string[];
  rows: React.ReactNode[][];
  caption?: string;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table
          className={`w-full text-left text-sm ${headings.length > 4 ? "min-w-[640px]" : ""}`}
        >
          <thead>
            <tr className="border-b-2 border-slate-200">
              {headings.map((h, i) => (
                <th className="px-1 py-3 font-bold" key={i}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-200">
                  {row.map((v, j) => (
                    <td className="px-1 py-3 align-top leading-6" key={j}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={headings.length}
                  className="py-5 text-center text-slate-500"
                >
                  Nema evidentiranih podataka.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {caption && (
        <p className="mt-4 text-sm text-slate-500">Tablica: {caption}</p>
      )}
    </>
  );
}
function rendered(field: Field, value: string | undefined) {
  if (!value) return "Nije evidentirano";
  return field.options?.find(([key]) => key === value)?.[1] || value;
}
function ExtraRecords({
  result,
  kind,
}: {
  result: IsspData;
  kind: RecordKind;
}) {
  const def = recordDefinitions[kind],
    fields: readonly Field[] = def.fields;
  const records = result.records
    .filter(
      (r) => r.account_id === result.account?.id && r.kind === kind && r.active,
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <IsspSection title={def.title} id={`issp-${kind}`}>
      <IsspTable
        headings={[
          "Visoko učilište",
          ...fields.map((f) => f.label),
          "Izvor / odluka",
        ]}
        rows={records.map((r) => [
          result.data.institution.name,
          ...fields.map((f) => (
            <span
              className={
                (kind === "card" || kind === "temporary_card") &&
                f.name === "number" &&
                r.payload.active === "yes"
                  ? "font-bold text-green-700 underline"
                  : ""
              }
              key={f.name}
            >
              {rendered(f, r.payload[f.name])}
            </span>
          )),
          r.reference,
        ])}
        caption={def.title.toLocaleLowerCase("hr")}
      />
      {kind === "employment" && (
        <p className="mt-3 text-xs text-slate-500">
          Status ručno evidentira ovlašteno osoblje. Povezivanje s HZMO-om nije
          uspostavljeno.
        </p>
      )}
      {["card", "temporary_card"].includes(kind) && (
        <p className="mt-3 text-xs text-slate-500">
          Podcrtani broj označava iskaznicu evidentiranu kao aktivnu u vašem
          sustavu.
        </p>
      )}
    </IsspSection>
  );
}
function Criteria({
  result,
  kind,
}: {
  result: IsspData;
  kind: "work_criterion" | "dining_criterion";
}) {
  const definitions = kind === "work_criterion" ? workCriteria : diningCriteria;
  const records = result.records
    .filter(
      (r) => r.account_id === result.account?.id && r.active && r.kind === kind,
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <IsspSection title={recordDefinitions[kind].title}>
      <IsspTable
        headings={["Naziv", "Uvjet zadovoljen", "Izvor / odluka"]}
        rows={definitions.map(([code, label]) => {
          const r = records.find((r) => r.payload.criterion === code);
          return [
            label,
            r?.payload.status === "yes" ? (
              <span className="font-semibold text-green-700">DA</span>
            ) : r?.payload.status === "no" ? (
              "NE"
            ) : (
              "Nije provjereno"
            ),
            r?.reference || "—",
          ];
        })}
      />
      <p className="mt-4 text-xs text-slate-500">
        Prikazane su provjere koje je evidentirala referada. Nepoznati uvjeti ne
        smatraju se zadovoljenima.
      </p>
    </IsspSection>
  );
}
function AcademicRecords({ result }: { result: IsspData }) {
  const { data, student } = result;
  const studies = data.studies.filter((s) => s.student_id === student);
  const rows = studies.map((s) => {
    const c = data.enrollmentCases.find((c) => c.study_id === s.id);
    return {
      s,
      c,
      p: data.programs.find((p) => p.id === s.program_id),
      year: data.years.find((y) => y.id === s.academic_year_id)?.name || "—",
    };
  });
  return (
    <>
      <IsspSection title="Upisi godine">
        <IsspTable
          headings={[
            "Visoko učilište",
            "Ak. godina",
            "Studij",
            "Godina koju upisuje",
            "Način studiranja",
            "Status",
          ]}
          rows={rows
            .filter((r) => r.c?.kind !== "postgraduate")
            .map(({ s, c, p, year }) => [
              data.institution.name,
              year,
              p?.name || "—",
              s.study_year,
              c
                ? c.mode === "full_time"
                  ? "Redoviti"
                  : "Izvanredni"
                : "Nije evidentirano",
              s.status === "active"
                ? "Aktivan"
                : s.status === "paused"
                  ? "Mirovanje"
                  : "Završen",
            ])}
          caption="upisi iz referade"
        />
      </IsspSection>
      <IsspSection title="Upisi u poslijediplomski studij">
        <IsspTable
          headings={[
            "Visoko učilište",
            "Ak. godina",
            "Studij",
            "Godina koju upisuje",
          ]}
          rows={rows
            .filter((r) => r.c?.kind === "postgraduate")
            .map(({ s, p, year }) => [
              data.institution.name,
              year,
              p?.name || "—",
              s.study_year,
            ])}
        />
      </IsspSection>
      <IsspSection title="ECTS bodovi">
        <IsspTable
          headings={[
            "Visoko učilište",
            "Ak. godina",
            "Studij",
            "Razina studija",
            "Ostvareni ECTS",
          ]}
          rows={rows.map(({ s, p, year }) => {
            const courses = data.courses.filter(
              (c) =>
                c.program_id === s.program_id &&
                data.semesters.some(
                  (t) =>
                    t.id === c.semester_id &&
                    t.academic_year_id === s.academic_year_id,
                ),
            );
            const progress = studentProgress(
              courses,
              data.exams,
              data.grades,
              student!,
            );
            return [
              data.institution.name,
              year,
              p?.name || "—",
              p?.degree || "—",
              progress.earned,
            ];
          })}
        />
        <p className="mt-3 text-xs text-slate-500">
          Izračun iz evidentiranih položenih ispita. Dodatni priznati ECTS
          prikazani su zasebno u Studomatu.
        </p>
      </IsspSection>
      <IsspSection title="Težinski prosjek ocjena">
        <IsspTable
          headings={[
            "Naziv ustanove",
            "Naziv studija",
            "Ak. godina",
            "Prosjek ocjena",
          ]}
          rows={rows.flatMap(({ s, p, year }) => {
            const courses = data.courses.filter(
              (c) =>
                c.program_id === s.program_id &&
                data.semesters.some(
                  (t) =>
                    t.id === c.semester_id &&
                    t.academic_year_id === s.academic_year_id,
                ),
            );
            const progress = studentProgress(
              courses,
              data.exams,
              data.grades,
              student!,
            );
            return progress.weighted === null
              ? []
              : [
                  [
                    data.institution.name,
                    p?.name || "—",
                    year,
                    progress.weighted.toLocaleString("hr-HR", {
                      maximumFractionDigits: 3,
                    }),
                  ],
                ];
          })}
        />
        <p className="mt-3 text-xs text-slate-500">
          Izračun pri prikazu: ocjene položenih ispita ponderirane ECTS
          bodovima. Nije potvrda za stipendiju.
        </p>
      </IsspSection>
    </>
  );
}
function Personal({ result, base }: { result: IsspData; base: string }) {
  const { data, student, account, profile } = result;
  const record = data.studentRecords.find((r) => r.student_id === student);
  const annual = data.studentYearRecords.find(
    (r) => r.student_id === student && r.academic_year_id === result.year?.id,
  );
  const summary = financialSummary(
    result.transactions.filter((t) => t.account_id === account?.id),
  );
  const name =
    record?.legal_name ||
    data.profiles.find((p) => p.id === student)?.full_name ||
    "Student";
  const esi = result.records
    .filter((r) => r.kind === "esi" && r.active && r.account_id === account?.id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const link = (view: string) => {
    const u = new URL(base);
    u.searchParams.set("view", view);
    return u.toString();
  };
  const photo = new URL("/api/issp/photo", base);
  photo.searchParams.set("institution", data.institution.id);
  photo.searchParams.set("student", student!);
  return (
    <>
      <div className="mb-10 grid gap-8 md:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
        <aside className="space-y-8">
          <div className="flex aspect-square items-center justify-center rounded border border-slate-200 bg-slate-50 p-1">
            {profile?.photo_path ? (
              <StudentPortrait src={photo.toString()} name={name} />
            ) : (
              <div className="p-6 text-center text-slate-400">
                <UserRound className="mx-auto mb-4" size={90} />
                <p className="text-sm">Fotografija nije evidentirana</p>
              </div>
            )}
          </div>
          <a
            href={link("Osobni računi")}
            className="flex gap-2 text-sm font-semibold leading-6"
          >
            <FileText size={20} className="shrink-0" />
            Prikaz liste osobnih računa za zadnjih 30 dana
          </a>
          <a
            href={
              new URL("/api/issp/export", base).toString() +
              `?institution=${data.institution.id}&student=${student}`
            }
            className="flex gap-2 text-sm font-semibold leading-6"
          >
            <Download size={20} className="shrink-0" />
            Preuzmi sve osobne račune (.pdf)
          </a>
          <a
            href={link("Postavke obavijesti")}
            className="flex gap-2 text-sm font-semibold"
          >
            <Mail size={20} />
            Obavijesti o potrošnji
          </a>
        </aside>
        <section className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <p className="mt-3 text-sm font-semibold">
            Nadležna ustanova: {data.institution.name}
          </p>
          <div className="my-4 grid grid-cols-2 gap-5 border-y border-[#cbd66f] py-5 text-center lg:grid-cols-4">
            {[
              ["Razina prava", account?.rights_level || "Nije evidentirano"],
              [
                "Raspoloživi saldo",
                account ? euro(summary.balance) : "Nije evidentirano",
              ],
              [
                "Potrošeno danas",
                account ? euro(summary.spentToday) : "Nije evidentirano",
              ],
              ["Dnevna potpora", euro(account?.daily_support_cents)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-bold uppercase">{label}</p>
                <p className="mt-2 text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
          <p className="border-b border-[#cbd66f] pb-4 text-xs leading-5 text-slate-500">
            Saldo se računa iz dodjela, potrošnje i storna u vašoj evidenciji.
            Ne predstavlja saldo državnog sustava prehrane.
          </p>
          <dl className="my-5 space-y-2 text-sm leading-5">
            {[
              [
                "Prebivalište",
                [
                  annual?.details.residence_address,
                  annual?.details.residence_city,
                  annual?.details.residence_country,
                ]
                  .filter(Boolean)
                  .join(", "),
              ],
              [
                "Boravište",
                [annual?.details.housing_address, annual?.details.housing_city]
                  .filter(Boolean)
                  .join(", "),
              ],
              ["Državljanstvo", record?.citizenship],
              ["OIB", record?.oib],
              ["JMBAG", record?.jmbag],
              ["Europski studentski identifikator (ESI)", esi?.payload.value],
              ["Datum rođenja", record?.birth_date],
              ["Telefon", profile?.phone],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="inline font-bold">{label}: </dt>
                <dd className="inline">{value || "Nije evidentirano"}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 border-y border-slate-200 py-5 text-sm">
            <p>
              <strong>Razdoblje prava: </strong>
              {account
                ? zagrebDay() < account.valid_from
                  ? "Još nije započelo"
                  : zagrebDay() > account.valid_until
                    ? "Isteklo"
                    : "U tijeku"
                : "Nije evidentirano"}
            </p>
            <p>
              <strong>Pravo na prehranu trenutačno aktivno: </strong>
              {account
                ? diningRightsActive(account, result.records)
                  ? "DA"
                  : "NE"
                : "Nije evidentirano"}
            </p>
            <p>
              <strong>Prava od datuma: </strong>
              {account?.valid_from || "Nije evidentirano"}
            </p>
            <p>
              <strong>Prava do datuma: </strong>
              {account?.valid_until || "Nije evidentirano"}
            </p>
            <p>
              <strong>Datum izmjene prava: </strong>
              {account ? hrDate(account.updated_at) : "Nije evidentirano"}
            </p>
            <p>
              <strong>Izvor / odluka: </strong>
              {account?.reference || "Nije evidentirano"}
            </p>
            {account?.note && (
              <p>
                <strong>Napomena: </strong>
                {account.note}
              </p>
            )}
          </div>
          <p className="mt-5 text-sm font-medium leading-6">
            Za ispravak službenih podataka obratite se referadi nadležne
            ustanove.
          </p>
        </section>
      </div>
      <Criteria result={result} kind="work_criterion" />
      <Criteria result={result} kind="dining_criterion" />
      {(
        [
          "employment",
          "termination",
          "special_right",
          "disability",
          "dorm",
          "pause",
          "card",
          "temporary_card",
        ] as const
      ).map((kind) => (
        <ExtraRecords key={kind} result={result} kind={kind} />
      ))}
      <AcademicRecords result={result} />
      <ExtraRecords result={result} kind="mobility" />
      {data.services.some(
        (s) => s.student_id === student && s.kind === "mobility",
      ) && (
        <IsspSection title="Boravci iz studentske evidencije">
          <IsspTable
            headings={["Ustanova", "Država", "Svrha", "Od", "Do"]}
            rows={data.services
              .filter((s) => s.student_id === student && s.kind === "mobility")
              .map((s) => [
                s.payload.institution,
                s.payload.country,
                s.payload.purpose,
                s.payload.starts_on,
                s.payload.ends_on,
              ])}
          />
        </IsspSection>
      )}
      <ExtraRecords result={result} kind="ownership" />
      <IsspSection title="Obavijest o potrošnji e-računom">
        <IsspTable
          headings={["E-mail adresa", "Odobreno slanje obavijesti"]}
          rows={
            result.preferences
              ? [
                  [
                    result.preferences.contact_email || "Nije unesena",
                    result.preferences.notifications ? "DA" : "NE",
                  ],
                ]
              : []
          }
        />
        <p className="mt-3 text-xs text-slate-500">
          Ovdje se evidentira odabir. Dostava obavijesti e-poštom još nije
          aktivirana.
        </p>
      </IsspSection>
      <ExtraRecords result={result} kind="esi" />
    </>
  );
}
export function Receipts({ result }: { result: IsspData }) {
  const rows = result.transactions.filter(
    (t) => t.account_id === result.account?.id,
  );
  const summary = financialSummary(rows);
  const cutoff = Date.now() - 30 * 86400000;
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Osobni računi</h1>
      <p className="mb-6 text-sm text-slate-500">
        Lokalna evidencija za posljednjih 30 dana. Saldo odabrane akademske
        godine: {result.account ? euro(summary.balance) : "Nije evidentirano"}.
      </p>
      <IsspTable
        headings={[
          "Datum",
          "Vrsta",
          "Prodajno mjesto / izvor",
          "Broj / oznaka",
          "Ukupno",
          "Potpora",
          "Status",
        ]}
        rows={rows
          .filter((r) => new Date(r.occurred_at).getTime() >= cutoff)
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
          .map((r) => [
            hrDate(r.occurred_at),
            r.kind === "purchase"
              ? "Račun"
              : r.kind === "allocation"
                ? "Dodjela"
                : "Storno",
            r.provider,
            r.reference,
            euro(r.total_cents),
            euro(r.delta_cents),
            summary.reversed.has(r.id) ? "Stornirano" : "Evidentirano",
          ])}
      />
    </div>
  );
}
export async function IsspWorkspace({
  institution,
  student,
  year,
  view,
  status,
}: {
  institution?: string;
  student?: string;
  year?: string;
  view: string;
  status?: string;
}) {
  const result = await isspData(institution, student, year);
  const url = await navigation();
  const base = new URL(url("issp"));
  if (!result)
    return <main className="p-8">Nemate ustanovu za pristup ISSP-u.</main>;
  base.searchParams.set("institution", result.data.institution.id);
  if (result.student) base.searchParams.set("student", result.student);
  if (result.year) base.searchParams.set("academic_year", result.year.id);
  const tabs = [
    "Pregled osobnih podataka",
    "Osobni računi",
    "Postavke obavijesti",
    ...(result.manager ? ["Upravljanje evidencijom"] : []),
  ];
  const active = tabs.includes(view) ? view : tabs[0];
  const chooser = (
    what: "institution" | "student" | "academic_year",
    title: string,
    entries: { id: string; name: string }[],
    value?: string,
  ) => (
    <form
      action={base.pathname}
      method="get"
      className="flex flex-wrap items-end gap-2"
    >
      {[...new URL(url("issp")).searchParams].map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input type="hidden" name="view" value={active} />
      {what !== "institution" && (
        <input
          type="hidden"
          name="institution"
          value={result.data.institution.id}
        />
      )}{" "}
      {what === "academic_year" && result.student && (
        <input type="hidden" name="student" value={result.student} />
      )}
      <label className="text-xs font-semibold">
        {title}
        <select
          className={`${input} block max-w-full`}
          name={what}
          defaultValue={value || ""}
          required
        >
          <option value="">Odaberite…</option>
          {entries.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <button className="rounded bg-[#656f21] px-3 py-2 text-sm font-semibold text-white">
        Prikaži
      </button>
    </form>
  );
  return (
    <div className="issp-surface min-h-screen bg-[#f8f9f6] px-3 py-4 text-[#292d30] md:px-6 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[1180px] border-t-4 border-[#b7c63f] bg-white shadow-md">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-[#bcc943] px-6 py-5 text-[#222719]">
          <div className="flex items-center gap-3">
            <a
              href={url("portal")}
              className="flex items-center gap-1 font-semibold"
            >
              <ArrowLeft size={18} />
              Naslovnica
            </a>
            <span>/</span>
            <a
              href={url("issp")}
              className="flex items-center gap-2 font-semibold"
            >
              <CreditCard size={20} />
              ISSP
            </a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href={url("auth")} className="text-sm">
              Moj račun
            </a>
          </div>
        </header>
        <div className="p-5 md:p-7">
          <p className="mb-5 text-xs text-slate-500">
            Studentski standard · vlastita evidencija ISVU-a
          </p>
          <div className="mb-5 flex flex-wrap items-end gap-5">
            {chooser(
              "institution",
              "Ustanova",
              result.available,
              result.data.institution.id,
            )}
            {result.manager &&
              chooser(
                "student",
                "Student",
                result.roster.map((s) => ({ id: s.id, name: s.full_name })),
                result.student,
              )}
            {result.student &&
              chooser(
                "academic_year",
                "Akademska godina",
                result.data.years
                  .filter((y) =>
                    result.data.studies.some(
                      (s) =>
                        s.student_id === result.student &&
                        s.academic_year_id === y.id,
                    ),
                  )
                  .map((y) => ({ id: y.id, name: y.name })),
                result.year?.id,
              )}
          </div>
          <nav
            aria-label="ISSP navigacija"
            className="mb-7 flex flex-wrap gap-2 border-b border-slate-200 pb-5"
          >
            {tabs.map((tab) => {
              const u = new URL(base);
              u.searchParams.set("view", tab);
              return (
                <a
                  key={tab}
                  href={u.toString()}
                  aria-current={tab === active ? "page" : undefined}
                  className={`rounded px-3 py-2 text-sm ${tab === active ? "bg-[#e1e6a1] font-semibold text-[#222719]" : "text-slate-500"}`}
                >
                  {tab}
                </a>
              );
            })}
          </nav>
          {status && (
            <p
              role={status === "saved" ? "status" : "alert"}
              className={`mb-6 rounded p-4 text-sm ${status === "saved" ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}
            >
              {status === "saved"
                ? "Promjena je spremljena."
                : isspErrors[status] || isspErrors.invalid}
            </p>
          )}
          {!result.student ? (
            <p className="py-10 text-sm text-slate-500">
              Odaberite studenta za pregled ili unos evidencija.
            </p>
          ) : result.needsEnrollment ? (
            <p className="py-8">
              Student najprije mora imati evidentiran upis u referadi.
            </p>
          ) : !result.ready ? (
            <p className="rounded bg-amber-50 p-5 text-sm text-amber-900">
              ISSP evidencije još nisu uključene.
              {result.manager
                ? " Primijenite migraciju 202611110001_issp.sql u ISVU projektu."
                : " Obratite se referadi svoje ustanove."}
            </p>
          ) : active === "Upravljanje evidencijom" && result.manager ? (
            <IsspAdmin result={result} />
          ) : active === "Osobni računi" ? (
            <Receipts result={result} />
          ) : active === "Postavke obavijesti" ? (
            <PreferencesForm result={result} />
          ) : (
            <Personal result={result} base={base.toString()} />
          )}
        </div>
      </div>
    </div>
  );
}
