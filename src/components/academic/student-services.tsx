import type { AcademicData } from "@/lib/academic/data";
import {
  serviceDefinitions,
  personalFields,
  participationAmount,
  type ServiceField,
  type StudentService,
} from "@/lib/academic/student-services";
import { Section, Table, Empty, person } from "./shared";
import { inputClass, Submit } from "@/components/auth/forms";
import type { ModuleSlug } from "@/lib/modules";
import { navigation } from "@/lib/context";
import { PrintPage } from "./print-page";
const euro = (v: unknown) =>
  new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(
    Number(v),
  );
function ServiceFields({
  fields,
  row,
  data,
}: {
  fields: readonly ServiceField[];
  row?: StudentService;
  data: AcademicData;
}) {
  return fields.map((f) => (
    <label key={f.name} className="block text-sm font-medium">
      {f.label}
      {f.name === "course_id" ? (
        <select
          required
          className={inputClass}
          name={f.name}
          defaultValue={row?.payload[f.name] || ""}
        >
          <option value="">Odaberite kolegij</option>
          {data.courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : f.type === "textarea" ? (
        <textarea
          required={!f.optional}
          className={inputClass}
          name={f.name}
          maxLength={5000}
          defaultValue={row?.payload[f.name] || ""}
        />
      ) : (
        <input
          required={!f.optional}
          className={inputClass}
          name={f.name}
          type={f.type || "text"}
          step={f.type === "number" ? "0.01" : undefined}
          min={f.type === "number" ? 0 : undefined}
          maxLength={f.type ? undefined : 200}
          defaultValue={row?.payload[f.name] ?? ""}
        />
      )}
    </label>
  ));
}
export function StudentServicesAdmin({
  data,
  module,
}: {
  data: AcademicData;
  module: ModuleSlug;
}) {
  if (!data.manager)
    return <Empty>Nemate ovlasti za studentske evidencije.</Empty>;
  if (!data.servicesReady)
    return (
      <Empty>
        Primijenite migraciju 202611020004_student_services.sql za nove
        studentske evidencije.
      </Empty>
    );
  const common = (row?: StudentService) => (
    <>
      <input type="hidden" name="institution_id" value={data.institution.id} />
      <input type="hidden" name="return_module" value={module} />
      <input type="hidden" name="return_view" value="Studentske evidencije" />
      {row && <input type="hidden" name="id" value={row.id} />}
      <label>
        Student
        <select
          required
          name="student_id"
          className={inputClass}
          defaultValue={row?.student_id}
        >
          <option value="">Odaberite…</option>
          {data.members
            .filter((m) => m.role === "student")
            .map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {person(data, m.user_id)}
              </option>
            ))}
        </select>
      </label>
      <label>
        Akademska godina
        <select
          required
          name="academic_year_id"
          className={inputClass}
          defaultValue={row?.academic_year_id}
        >
          <option value="">Odaberite…</option>
          {data.years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        Ovdje referada evidentira prava, financijske obveze, odluke i prisustvo.
        Osobne godišnje podatke unose studenti u Studomatu. Iznosi participacije
        izračunavaju se prema parametrima koje unesete, bez pretpostavke o
        službenim pravilima ustanove.
      </p>
      {Object.entries(serviceDefinitions).map(([kind, def]) => (
        <Section key={kind} title={def.title}>
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold text-blue-700">
              Dodaj zapis · {def.title}
            </summary>
            <form
              method="post"
              action="/api/student-services/save"
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              {common()}
              <input type="hidden" name="kind" value={kind} />
              <ServiceFields data={data} fields={def.fields} />
              <Submit>Spremi zapis</Submit>
            </form>
          </details>
          {data.services
            .filter((s) => s.kind === kind)
            .map((s) => (
              <details key={s.id} className="mt-3 rounded-lg border p-4">
                <summary className="cursor-pointer">
                  {person(data, s.student_id)} ·{" "}
                  {data.years.find((y) => y.id === s.academic_year_id)?.name} ·{" "}
                  {String(
                    s.payload.title ||
                      s.payload.level ||
                      s.payload.category ||
                      s.payload.institution ||
                      s.payload.basis ||
                      s.payload.date ||
                      "Zapis",
                  )}
                </summary>
                <form
                  method="post"
                  action="/api/student-services/save"
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                >
                  {common(s)}
                  <input type="hidden" name="kind" value={kind} />
                  <ServiceFields data={data} fields={def.fields} row={s} />
                  <Submit>Spremi izmjene</Submit>
                </form>
                <form
                  method="post"
                  action="/api/student-services/delete"
                  className="mt-4"
                >
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="institution_id"
                    value={s.institution_id}
                  />
                  <input
                    type="hidden"
                    name="academic_year_id"
                    value={s.academic_year_id}
                  />
                  <input type="hidden" name="return_module" value={module} />
                  <input
                    type="hidden"
                    name="return_view"
                    value="Studentske evidencije"
                  />
                  <Submit>Ukloni zapis</Submit>
                </form>
              </details>
            ))}
        </Section>
      ))}
      <Section title="Godišnji osobni podaci studenata">
        {data.reports.map((r) => (
          <details key={r.id} className="rounded-lg border p-4">
            <summary>
              {person(data, r.student_id)} ·{" "}
              {data.years.find((y) => y.id === r.academic_year_id)?.name}
            </summary>
            <Table
              headings={["Podatak", "Vrijednost"]}
              rows={personalFields.map((f) => [
                f.label,
                r.personal[f.name] || "Nije evidentirano",
              ])}
            />
          </details>
        ))}
      </Section>
    </div>
  );
}
export async function StudentServices({
  data,
  view,
  yearId,
}: {
  data: AcademicData;
  view: string;
  yearId?: string;
}) {
  const url = await navigation();
  if (view === "Moj račun ustanove")
    return (
      <Section title="Moj račun ustanove">
        <p>
          Podaci za prijavu i sigurnost računa dostupni su u modulu Prijava u
          sustav.
        </p>
        <a className="text-blue-700 underline" href={url("auth")}>
          Otvori svoj račun
        </a>
        {data.institution.identity_portal_url?.startsWith("https://") ? (
          <a
            className="block text-blue-700 underline"
            href={data.institution.identity_portal_url}
            rel="noreferrer"
          >
            Identitetski portal ustanove
          </a>
        ) : (
          <Empty>
            Ustanova nije konfigurirala vanjski identitetski portal. Povezanost
            s AAI@EduHr nije postavljena.
          </Empty>
        )}
      </Section>
    );
  if (view === "Upute")
    return (
      <Section title="Upute">
        <p className="whitespace-pre-wrap">
          {data.institution.student_instructions ||
            "Ustanova još nije objavila vlastite upute."}
        </p>
        <p>
          Za ispit odaberite Prijava ispita. Odjava je moguća do roka odjave. U
          Osobnim podacima birajte akademsku godinu i spremite promjene. Za
          ispravke službenih evidencija javite se referadi.
        </p>
      </Section>
    );
  if (view === "Kontakt referade")
    return (
      <Section title="Kontakt referade">
        <p className="whitespace-pre-wrap">
          {data.institution.registrar_contact ||
            "Kontakt referade još nije konfiguriran. Obratite se administratoru ustanove."}
        </p>
      </Section>
    );
  if (!data.servicesReady)
    return (
      <Empty>
        Studentske evidencije bit će dostupne nakon primjene migracije
        202611020004_student_services.sql.
      </Empty>
    );
  const years = [...data.years].sort((a, b) =>
    b.starts_on.localeCompare(a.starts_on),
  );
  const year =
    years.find((y) => y.id === yearId) ||
    years.find(
      (y) =>
        y.starts_on <= new Date().toISOString().slice(0, 10) &&
        y.ends_on >= new Date().toISOString().slice(0, 10),
    ) ||
    years[0];
  if (!year)
    return <Empty>Ustanova najprije treba dodati akademsku godinu.</Empty>;
  const report = data.reports.find(
    (r) =>
      r.student_id === data.account.user.id && r.academic_year_id === year.id,
  );
  const hidden = (
    <>
      <input type="hidden" name="institution_id" value={data.institution.id} />
      <input type="hidden" name="academic_year_id" value={year.id} />
      <input type="hidden" name="return_view" value={view} />
    </>
  );
  const base = new URL(url("studomat"));
  const chooser = (
    <form
      action={base.pathname}
      method="get"
      className="mb-5 flex flex-wrap items-end gap-3"
    >
      {[...base.searchParams].map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="institution" value={data.institution.id} />
      <label>
        Akademska godina
        <select
          name="academic_year"
          className={inputClass}
          defaultValue={year.id}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </label>
      <Submit>Prikaži godinu</Submit>
    </form>
  );
  if (view === "Osobni podaci")
    return (
      <Section title="Samoprijavljeni osobni podaci">
        <p className="text-sm text-slate-500">
          Ovdje unosite vlastite podatke za provjeru. Službene matične i
          godišnje podatke vodi referada; njihov prikaz dostupan je zasebno u
          izborniku.
        </p>
        {chooser}
        <Table
          headings={["Podatak", "Vrijednost"]}
          rows={[
            ["Ime i prezime", data.account.profile.full_name],
            ["Korisničko ime", data.account.user.email],
            ["Ustanova", data.institution.name],
          ]}
        />
        <form
          action="/api/student-services/personal"
          method="post"
          className="grid gap-4 sm:grid-cols-2"
        >
          {hidden}
          {personalFields.map((f) => (
            <label key={f.name} className="text-sm">
              {f.label}
              <input
                className={inputClass}
                name={f.name}
                maxLength={300}
                defaultValue={report?.personal[f.name] || ""}
              />
            </label>
          ))}
          <Submit>Spremi podatke za akademsku godinu</Submit>
        </form>
      </Section>
    );
  if (view === "E-mail opcije")
    return (
      <Section title="E-mail opcije">
        {chooser}
        <p className="text-sm text-slate-500">
          Ovo su postavke obavijesti, a ne promjena korisničkog imena. Samo
          spremanje postavki ne šalje e-poštu; pružatelj za dostavu obavijesti
          još nije povezan.
        </p>
        <form
          action="/api/student-services/preferences"
          method="post"
          className="mt-5 space-y-4"
        >
          {hidden}
          <label>
            Kontaktna e-adresa
            <input
              type="email"
              name="contact_email"
              defaultValue={report?.preferences.contact_email || ""}
              className={inputClass}
            />
          </label>
          {[
            ["exam_registration", "Prijava ispita"],
            ["exam_withdrawal", "Odjava ispita"],
            ["announcements", "Obavijesti ustanove"],
          ].map(([k, l]) => (
            <label key={k} className="flex gap-3">
              <input
                type="checkbox"
                name={k}
                defaultChecked={Boolean(
                  report?.preferences[k as keyof typeof report.preferences],
                )}
              />
              {l}
            </label>
          ))}
          <Submit>Spremi postavke</Submit>
        </form>
      </Section>
    );
  const entry = Object.entries(serviceDefinitions).find(
    ([, d]) => d.title === view,
  );
  if (!entry) return <Empty>Nema takvog studentskog pregleda.</Empty>;
  const [kind, definition] = entry;
  const records = data.services.filter(
    (s) =>
      s.student_id === data.account.user.id &&
      s.kind === kind &&
      s.academic_year_id === year.id,
  );
  return (
    <Section title={view}>
      {chooser}
      {records.length ? (
        records.map((s) => (
          <article key={s.id} className="mb-5 rounded-xl border bg-white p-5">
            <Table
              headings={["Podatak", "Vrijednost"]}
              rows={definition.fields.map((f) => [
                f.label,
                f.name === "course_id"
                  ? data.courses.find((c) => c.id === s.payload.course_id)
                      ?.name || "Kolegij"
                  : String(s.payload[f.name] ?? "Nije evidentirano"),
              ])}
            />
            {kind === "participation" && (
              <p className="mt-5 font-bold">
                Izračunata participacija: {euro(participationAmount(s.payload))}
              </p>
            )}
            {kind === "tuition" && (
              <p className="mt-5 font-bold">
                Preostalo za uplatu:{" "}
                {euro(Number(s.payload.amount) - Number(s.payload.paid))}
              </p>
            )}
            {kind === "certificate" && (
              <>
                <p>
                  Student: {data.account.profile.full_name} · Ustanova:{" "}
                  {data.institution.name}
                </p>
                <p className="text-sm text-slate-500">
                  Ispis evidencije iz aplikacije. Nije digitalno potpisan
                  dokument.
                </p>
                <PrintPage />
              </>
            )}
          </article>
        ))
      ) : (
        <Empty>Nema evidentiranih podataka za odabranu akademsku godinu.</Empty>
      )}
    </Section>
  );
}
