import type { IsspData } from "@/lib/issp/data";
import {
  recordDefinitions,
  moneyInput,
  euro,
  financialSummary,
  type Field,
  type IsspRecord,
} from "@/lib/issp/model";
import { zagrebInput, hrDate } from "@/lib/academic/time";
const input =
  "mt-1 block w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded bg-[#656f21] px-4 py-2 text-sm font-semibold text-white";
export function ScopeFields({
  result,
  view = "Upravljanje evidencijom",
  revision = 0,
}: {
  result: IsspData;
  view?: string;
  revision?: number;
}) {
  return (
    <>
      <input
        type="hidden"
        name="institution_id"
        value={result.data.institution.id}
      />
      <input type="hidden" name="student_id" value={result.student} />
      <input type="hidden" name="academic_year_id" value={result.year?.id} />
      <input type="hidden" name="account_id" value={result.account?.id || ""} />
      <input type="hidden" name="return_view" value={view} />
      <input type="hidden" name="revision" value={revision} />
    </>
  );
}
function FieldInput({
  name,
  label,
  value = "",
  type = "text",
  required = true,
  maxLength = 200,
}: {
  name: string;
  label: string;
  value?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      {type === "textarea" ? (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          maxLength={maxLength}
          rows={3}
          className={input}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={maxLength}
          className={input}
        />
      )}
    </label>
  );
}
function RecordForm({
  result,
  kind,
  record,
}: {
  result: IsspData;
  kind: keyof typeof recordDefinitions;
  record?: IsspRecord;
}) {
  const fields: readonly Field[] = recordDefinitions[kind].fields;
  return (
    <form
      action="/api/issp/record"
      method="post"
      className="mt-4 grid gap-4 md:grid-cols-2"
    >
      <ScopeFields result={result} revision={record?.revision} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={record?.id || ""} />
      {fields.map((f) =>
        f.options ? (
          <label key={f.name} className="text-sm font-semibold">
            {f.label}
            <select
              required
              name={`field_${f.name}`}
              aria-label={f.label}
              defaultValue={record?.payload[f.name] || ""}
              className={input}
            >
              <option value="">Odaberite…</option>
              {f.options.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <FieldInput
            key={f.name}
            name={`field_${f.name}`}
            label={f.label}
            value={record?.payload[f.name]}
            type={f.type}
            required={!f.optional}
            maxLength={f.type === "textarea" ? 2000 : 200}
          />
        ),
      )}
      <FieldInput
        name="reference"
        label="Izvor provjere / oznaka odluke"
        value={record?.reference}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={record?.active ?? true}
        />
        Zapis vrijedi (isključite za povlačenje pogrešnog zapisa)
      </label>
      <div className="md:col-span-2">
        <button className={button}>Spremi evidenciju</button>
      </div>
    </form>
  );
}
export function PreferencesForm({ result }: { result: IsspData }) {
  if (result.student !== result.data.account.user.id)
    return (
      <p className="text-sm">
        Postavke obavijesti mijenja student na svojem računu.
      </p>
    );
  return (
    <section>
      <h1 className="text-2xl font-bold">Obavijesti o potrošnji</h1>
      <p className="my-5 text-sm leading-6 text-slate-500">
        Spremite adresu i odabir primanja obavijesti. Slanje e-pošte još nije
        aktivirano; ova promjena ne šalje poruku i ne mijenja korisničko ime.
      </p>
      <form
        action="/api/issp/preferences"
        method="post"
        className="max-w-xl space-y-4"
      >
        <ScopeFields
          result={result}
          view="Postavke obavijesti"
          revision={result.preferences?.revision}
        />
        <FieldInput
          name="contact_email"
          label="E-mail adresa za obavijesti"
          value={result.preferences?.contact_email}
          type="email"
          required={false}
          maxLength={254}
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="notifications"
            defaultChecked={result.preferences?.notifications}
          />
          Odobravam primanje obavijesti o potrošnji na unesenu adresu.
        </label>
        <button className={button}>Spremi postavke</button>
      </form>
    </section>
  );
}
export function IsspAdmin({ result }: { result: IsspData }) {
  if (!result.manager || !result.student || !result.year) return null;
  const account = result.account,
    rows = result.transactions.filter((t) => t.account_id === account?.id);
  const summary = financialSummary(rows);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upravljanje evidencijom</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Unosite podatke samo za odabranog studenta i ustanovu. Službene
          matične podatke i upise uređujte u referadi. Unosi ovdje ne mijenjaju
          državni ISSP, HZMO niti stvarne studentske iskaznice.
        </p>
      </div>
      <section className="rounded border border-slate-200 p-5">
        <h2 className="text-lg font-bold">
          Prava i račun prehrane · {result.year.name}
        </h2>
        <form
          action="/api/issp/account"
          method="post"
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <ScopeFields result={result} revision={account?.revision} />
          <FieldInput
            name="rights_level"
            label="Razina prava"
            value={account?.rights_level}
            required={false}
            maxLength={50}
          />
          <FieldInput
            name="daily_support"
            label="Dnevna potpora EUR (prazno: nije evidentirano)"
            value={moneyInput(account?.daily_support_cents)}
            required={false}
          />
          <FieldInput
            name="valid_from"
            label="Prava od datuma"
            type="date"
            value={account?.valid_from || result.year.starts_on}
          />
          <FieldInput
            name="valid_until"
            label="Prava do datuma"
            type="date"
            value={account?.valid_until || result.year.ends_on}
          />
          <FieldInput
            name="reference"
            label="Oznaka odluke o pravima"
            value={account?.reference}
          />
          <FieldInput
            name="note"
            label="Napomena"
            type="textarea"
            required={false}
            value={account?.note}
            maxLength={2000}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="dining_enabled"
              defaultChecked={account?.dining_enabled ?? false}
            />
            Pravo na prehranu odobreno
          </label>
          <div className="md:col-span-2">
            <button className={button}>Spremi prava i račun</button>
          </div>
        </form>
      </section>
      <section className="rounded border border-slate-200 p-5">
        <h2 className="text-lg font-bold">Telefon i fotografija</h2>
        <form
          action="/api/issp/profile"
          method="post"
          className="mt-4 space-y-4"
        >
          <ScopeFields result={result} revision={result.profile?.revision} />
          <input
            type="hidden"
            name="photo_path"
            value={result.profile?.photo_path || ""}
          />
          <FieldInput
            name="phone"
            label="Telefon"
            value={result.profile?.phone}
            required={false}
            maxLength={80}
          />
          <button className={button}>Spremi telefon</button>
        </form>
        <form
          action="/api/issp/photo"
          method="post"
          encType="multipart/form-data"
          className="mt-6 space-y-4"
        >
          <ScopeFields result={result} revision={result.profile?.revision} />
          <input
            type="hidden"
            name="phone"
            value={result.profile?.phone || ""}
          />
          <label className="block text-sm font-semibold">
            Fotografija studenta
            <input
              className="mt-2 block max-w-full text-sm"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <p className="text-xs text-slate-500">
            JPG, PNG ili WebP, do 2 MB. Fotografija je privatna.
          </p>
          <button className={button}>Spremi fotografiju</button>
        </form>
      </section>
      {account ? (
        <>
          <section className="rounded border border-slate-200 p-5">
            <h2 className="text-lg font-bold">
              Dodjela potpore ili osobni račun
            </h2>
            <p className="my-4 text-sm">
              Raspoloživi saldo: <strong>{euro(summary.balance)}</strong>.
              Potrošnja ne može premašiti saldo.
            </p>
            <form
              action="/api/issp/transaction"
              method="post"
              className="grid gap-4 md:grid-cols-2"
            >
              <ScopeFields result={result} />
              <label className="text-sm font-semibold">
                Vrsta zapisa
                <select name="kind" aria-label="Vrsta zapisa" className={input}>
                  <option value="allocation">Dodjela potpore</option>
                  <option value="purchase">Osobni račun / potrošnja</option>
                </select>
              </label>
              <FieldInput
                name="occurred_at"
                label="Datum i vrijeme (hrvatsko vrijeme)"
                type="datetime-local"
                value={zagrebInput(new Date().toISOString())}
              />
              <FieldInput
                name="amount"
                label="Iznos potpore EUR (dodjela ili potrošnja)"
                value="0,00"
              />
              <FieldInput
                name="total"
                label="Ukupan iznos računa EUR (za dodjelu: 0)"
                value="0,00"
              />
              <FieldInput
                name="provider"
                label="Prodajno mjesto / izvor dodjele"
              />
              <FieldInput
                name="reference"
                label="Jedinstveni broj računa / oznaka dodjele"
              />
              <FieldInput
                name="description"
                label="Opis"
                type="textarea"
                required={false}
                maxLength={2000}
              />
              <div className="md:col-span-2">
                <button className={button}>Evidentiraj transakciju</button>
              </div>
            </form>
            <div className="mt-6 space-y-3">
              {[...rows]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((t) => (
                  <details
                    key={t.id}
                    className="rounded border border-slate-200 p-3"
                  >
                    <summary className="cursor-pointer text-sm">
                      {hrDate(t.occurred_at)} · {t.reference} ·{" "}
                      {euro(t.delta_cents)} ·{" "}
                      {summary.reversed.has(t.id)
                        ? "Stornirano"
                        : t.kind === "reversal"
                          ? "Storno"
                          : "Evidentirano"}
                    </summary>
                    <p className="mt-3 text-sm">
                      {t.provider} · {t.description}
                    </p>
                    {t.kind !== "reversal" && !summary.reversed.has(t.id) && (
                      <form
                        action="/api/issp/reverse"
                        method="post"
                        className="mt-4 space-y-3"
                      >
                        <ScopeFields result={result} />
                        <input
                          type="hidden"
                          name="transaction_id"
                          value={t.id}
                        />
                        <FieldInput
                          name="reference"
                          label="Jedinstvena oznaka storna"
                        />
                        <FieldInput
                          name="description"
                          label="Razlog storna"
                          maxLength={2000}
                        />
                        <button className={button}>Storniraj zapis</button>
                      </form>
                    )}
                  </details>
                ))}
            </div>
          </section>
          {Object.entries(recordDefinitions).map(([kind, def]) => (
            <section key={kind} className="rounded border border-slate-200 p-5">
              <h2 className="text-lg font-bold">{def.title}</h2>
              <details className="mt-4">
                <summary className="w-fit cursor-pointer text-sm font-semibold text-green-800">
                  Dodaj zapis · {def.title}
                </summary>
                <RecordForm
                  result={result}
                  kind={kind as keyof typeof recordDefinitions}
                />
              </details>
              {result.records
                .filter((r) => r.account_id === account.id && r.kind === kind)
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                .map((r) => (
                  <details
                    key={r.id}
                    className="mt-4 border-t border-slate-200 pt-3"
                  >
                    <summary className="cursor-pointer text-sm">
                      {r.reference} ·{" "}
                      {r.active ? "Važeći zapis" : "Povučen zapis"} ·{" "}
                      {hrDate(r.updated_at)}
                    </summary>
                    <RecordForm result={result} kind={r.kind} record={r} />
                  </details>
                ))}
            </section>
          ))}
        </>
      ) : (
        <p className="rounded bg-amber-50 p-4 text-sm text-amber-900">
          Najprije spremite prava i račun za akademsku godinu. Saldo se zatim
          povećava evidentiranom dodjelom potpore.
        </p>
      )}
    </div>
  );
}
