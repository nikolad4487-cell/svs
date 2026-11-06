"use client";
import { FirstEnrollment } from "./first-enrollment";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "./forms";
import {
  credentialPrintDocument,
  type CredentialSheet,
} from "@/lib/admin/credential-print";
type Mapping = {
  id: string;
  institution_id: string;
  program_id: string;
  academic_year_id: string;
  source_school_id: string;
  source_program_id: string;
  source_year_id: string;
  candidate_year_id: string;
  domain: string;
  matura_required: boolean;
  requirements_reference: string;
  enabled: boolean;
};
type Catalog = {
  programs: {
    id: string;
    name: string;
    school_id: string;
    schools: { name: string };
  }[];
  years: { id: string; label: string }[];
  mappings: Mapping[];
  institutions: { id: string; name: string; email_domains: string[] }[];
  targetPrograms: { id: string; institution_id: string; name: string }[];
  targetYears: { id: string; institution_id: string; name: string }[];
};
type Review = {
  graduation_verified: boolean;
  matura_verified: boolean;
  conditions_verified: boolean;
  evidence_reference: string;
};
type Candidate = {
  candidate_id: string;
  full_name: string;
  eligible: boolean;
  reasons: string[];
  schoolProof: boolean;
  review: Review | null;
  job: string | null;
};
type Issued = { user_id: string; credentials: CredentialSheet };
async function call(action: string, body: unknown) {
  const r = await fetch(`/api/admissions/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Postupak nije uspio.");
  return data;
}
export function AdmissionImport() {
  const [mode, setMode] = useState<"first" | "recorded">("first");
  return (
    <div className="space-y-6">
      <nav aria-label="Vrsta upisa" className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={mode === "first" ? "default" : "outline"}
          onClick={() => setMode("first")}
        >
          Prvi upis na fakultet
        </Button>
        <Button
          type="button"
          variant={mode === "recorded" ? "default" : "outline"}
          onClick={() => setMode("recorded")}
        >
          Preuzimanje već provedenih upisa
        </Button>
      </nav>
      {mode === "first" ? <FirstEnrollment /> : <RecordedAdmissionsImport />}
    </div>
  );
}
function RecordedAdmissionsImport() {
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [mapping, setMapping] = useState(""),
    [institution, setInstitution] = useState(""),
    [sourceProgram, setSourceProgram] = useState("");
  const [rows, setRows] = useState<Candidate[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [issued, setIssued] = useState<Issued[]>([]),
    [loginUrl, setLoginUrl] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [document, setDocument] = useState<string | null>(null);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Postupak nije uspio.");
    } finally {
      setBusy(false);
    }
  };
  const preview = async () => {
    const d = await call("preview", { mapping_id: mapping });
    setRows(d.rows);
    setSelected([]);
  };
  const current = catalog?.mappings.find((m) => m.id === mapping);
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold">
        Preuzmi već provedene fakultetske upise
      </h2>
      <p>
        Ova odvojena opcija služi samo kad je fakultetski upis već proveden u
        e-Matici. Za upis učenika koji tek dolazi na fakultet odaberite Prvi
        upis na fakultet. Izvor se samo čita. Prijenos zahtijeva prihvaćen
        izbor, stvarno proveden upis i provjeru uvjeta programa. Sama prijava
        mature nije dokaz prolaza.
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          run(async () => {
            setCatalog(await call("catalog", {}));
          })
        }
      >
        Dohvati ponudu i mapiranja
      </Button>
      {message && (
        <p role="status" className="rounded border bg-amber-50 p-4 text-sm">
          {message}
        </p>
      )}
      {catalog && (
        <>
          <details open={Boolean(editing)} className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">
              {editing
                ? "Uredi povezivanje programa"
                : "Poveži fakultet, program i godinu"}
            </summary>
            <form
              key={editing?.id || "new"}
              className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () => {
                  const p = catalog.programs.find(
                    (p) => p.id === sourceProgram,
                  );
                  if (!p) throw new Error("Odaberite izvorni program.");
                  await call("mapping", {
                    ...(editing ? { id: editing.id } : {}),
                    institution_id: institution,
                    program_id: f.get("program_id"),
                    academic_year_id: f.get("academic_year_id"),
                    source_school_id: p.school_id,
                    source_program_id: p.id,
                    source_year_id: f.get("source_year_id"),
                    candidate_year_id: f.get("candidate_year_id"),
                    domain: f.get("domain"),
                    matura_required: f.has("matura_required"),
                    requirements_reference: f.get("requirements_reference"),
                    enabled: f.has("enabled"),
                  });
                  setEditing(null);
                  setCatalog(await call("catalog", {}));
                  setMessage(
                    "Mapiranje je spremljeno. Odaberite ga ispod i pokrenite pregled.",
                  );
                });
              }}
            >
              <label>
                Izvorni fakultet / program
                <select
                  required
                  className={inputClass}
                  value={sourceProgram}
                  onChange={(e) => setSourceProgram(e.target.value)}
                >
                  <option value="">Odaberite…</option>
                  {catalog.programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.schools.name} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {(["source_year_id", "candidate_year_id"] as const).map(
                (name) => (
                  <label key={name}>
                    {name === "source_year_id"
                      ? "Godina provedenog fakultetskog upisa"
                      : "Godina kandidature"}
                    <select
                      required
                      className={inputClass}
                      name={name}
                      defaultValue={editing?.[name] || ""}
                    >
                      <option value="">Odaberite…</option>
                      {catalog.years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              )}
              <label>
                ISVU ustanova
                <select
                  required
                  className={inputClass}
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                >
                  <option value="">Odaberite…</option>
                  {catalog.institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ISVU program
                <select
                  required
                  className={inputClass}
                  name="program_id"
                  defaultValue={editing?.program_id || ""}
                  key={`p-${institution}`}
                >
                  <option value="">Odaberite…</option>
                  {catalog.targetPrograms
                    .filter((p) => p.institution_id === institution)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                ISVU akademska godina
                <select
                  required
                  className={inputClass}
                  name="academic_year_id"
                  defaultValue={editing?.academic_year_id || ""}
                  key={`y-${institution}`}
                >
                  <option value="">Odaberite…</option>
                  {catalog.targetYears
                    .filter((y) => y.institution_id === institution)
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Domena korisničkih imena
                <select
                  required
                  className={inputClass}
                  name="domain"
                  defaultValue={editing?.domain || ""}
                  key={`d-${institution}`}
                >
                  <option value="">Odaberite…</option>
                  {catalog.institutions
                    .find((i) => i.id === institution)
                    ?.email_domains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Pravilo upisa / osnova izuzeća
                <input
                  required
                  minLength={3}
                  maxLength={500}
                  name="requirements_reference"
                  defaultValue={editing?.requirements_reference || ""}
                  className={inputClass}
                />
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  name="matura_required"
                  defaultChecked={editing?.matura_required ?? true}
                />
                Program zahtijeva položenu maturu. Isključiti samo uz
                dokumentiranu osnovu izuzeća.
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={editing?.enabled ?? true}
                />
                Mapiranje je uključeno
              </label>
              <Button disabled={busy}>Spremi mapiranje</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setInstitution("");
                  setSourceProgram("");
                }}
              >
                Novo mapiranje
              </Button>
            </form>
          </details>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 w-full grow">
              Mapiranje
              <select
                className={inputClass}
                value={mapping}
                aria-label="Mapiranje"
                onChange={(e) => {
                  setMapping(e.target.value);
                  setRows([]);
                  setSelected([]);
                }}
              >
                <option value="">Odaberite…</option>
                {catalog.mappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {
                      catalog.institutions.find(
                        (i) => i.id === m.institution_id,
                      )?.name
                    }{" "}
                    ·{" "}
                    {
                      catalog.targetPrograms.find((p) => p.id === m.program_id)
                        ?.name
                    }{" "}
                    ·{" "}
                    {
                      catalog.targetYears.find(
                        (y) => y.id === m.academic_year_id,
                      )?.name
                    }
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={busy || !mapping} onClick={() => run(preview)}>
              Provjeri upise bez spremanja
            </Button>
          </div>
          {current && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setEditing(current);
                setInstitution(current.institution_id);
                setSourceProgram(current.source_program_id);
              }}
            >
              Uredi odabrano mapiranje
            </Button>
          )}
          {current && (
            <p className="text-sm text-slate-500">
              Osnova uvjeta: {current.requirements_reference} · Matura:{" "}
              {current.matura_required ? "obvezna" : "dokumentirano izuzeće"}
            </p>
          )}
          {rows.map((row) => (
            <article className="rounded-xl border p-5" key={row.candidate_id}>
              <label className="flex gap-3 font-semibold">
                <input
                  type="checkbox"
                  disabled={
                    busy ||
                    !row.eligible ||
                    row.job === "completed" ||
                    row.job === "running"
                  }
                  checked={selected.includes(row.candidate_id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, row.candidate_id]
                        : s.filter((id) => id !== row.candidate_id),
                    )
                  }
                />
                {row.full_name} ·{" "}
                {row.job === "completed"
                  ? "Već preneseno"
                  : row.job === "running"
                    ? "Prijenos u tijeku"
                    : row.eligible
                      ? "Spremno za prijenos"
                      : "Potrebna provjera"}
              </label>
              {row.reasons.length > 0 && (
                <ul className="my-3 list-disc pl-5 text-sm">
                  {row.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <details className="mt-4">
                <summary className="cursor-pointer text-blue-700">
                  Evidentiraj provjeru dokumenata
                </summary>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    run(async () => {
                      await call("review", {
                        mapping_id: mapping,
                        candidate_id: row.candidate_id,
                        graduation_verified: f.has("graduation_verified"),
                        matura_verified: f.has("matura_verified"),
                        conditions_verified: f.has("conditions_verified"),
                        evidence_reference: f.get("evidence_reference"),
                      });
                      await preview();
                      setMessage(
                        "Provjera je spremljena uz administratorski trag. Prijenos još nije pokrenut.",
                      );
                    });
                  }}
                >
                  <p className="text-sm">
                    Označite samo uvjete za koje ste provjerili vjerodostojan
                    rezultat ili dokument. Zapis prijave ispita nije dovoljan.
                  </p>
                  {(
                    [
                      [
                        "graduation_verified",
                        "Završetak srednje škole je provjeren",
                      ],
                      [
                        "matura_verified",
                        "Matura je položena i rezultat je provjeren",
                      ],
                      [
                        "conditions_verified",
                        "Ispunjeni su svi uvjeti ovog programa",
                      ],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex gap-2">
                      <input
                        name={key}
                        type="checkbox"
                        defaultChecked={Boolean(row.review?.[key])}
                      />
                      {label}
                    </label>
                  ))}
                  <label>
                    Oznaka dokumenta / evidencije
                    <input
                      required
                      minLength={3}
                      maxLength={1000}
                      name="evidence_reference"
                      className={inputClass}
                      defaultValue={row.review?.evidence_reference || ""}
                    />
                  </label>
                  <Button disabled={busy}>Spremi provjeru</Button>
                </form>
              </details>
            </article>
          ))}
          {mapping && rows.length === 0 && (
            <p className="text-sm text-slate-500">
              Pokrenite pregled. Ako nema rezultata, provjerite godinu
              kandidature i izvorne prijave za odabrani program.
            </p>
          )}
          <Button
            disabled={busy || !selected.length || selected.length > 5}
            onClick={() =>
              run(async () => {
                const d = await call("apply", {
                  mapping_id: mapping,
                  candidates: selected,
                });
                const newSheets = d.results.filter(
                  (r: { credentials?: CredentialSheet }) => r.credentials,
                );
                setIssued((s) => [...s, ...newSheets]);
                setLoginUrl(d.loginUrl);
                await preview();
                setMessage(
                  `Dovršeno: ${d.results.filter((r: { status: string }) => r.status === "completed").length}. Neuspjelo: ${d.results.filter((r: { status: string }) => r.status === "failed").length}. Sačuvajte pristupne podatke prije napuštanja stranice.`,
                );
              })
            }
          >
            Preuzmi odabrane potvrđene upise ({selected.length}/5)
          </Button>
        </>
      )}
      {issued.length > 0 && (
        <div className="rounded-xl border bg-blue-50 p-5">
          <p>
            Novi računi: {issued.length}. Lozinke postojećih računa nisu
            promijenjene. Ispišite ili preuzmite ove podatke prije napuštanja
            stranice.
          </p>
          <div className="mt-3 flex gap-3">
            <Button
              onClick={() =>
                setDocument(
                  credentialPrintDocument(
                    issued.map((i) => i.credentials),
                    loginUrl,
                  ),
                )
              }
            >
              Ispiši početne podatke
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const content = issued
                  .map(
                    (i) =>
                      JSON.stringify({
                        status: "candidate",
                        ...i.credentials,
                      }) +
                      "\n" +
                      JSON.stringify({
                        status: "created",
                        email: i.credentials.email,
                        user_id: i.user_id,
                      }) +
                      "\n",
                  )
                  .join("");
                const url = URL.createObjectURL(
                  new Blob([content], { type: "application/x-ndjson" }),
                );
                const a = window.document.createElement("a");
                a.href = url;
                a.download = "potvrdeni-upisi-pristupni-podaci.jsonl";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Preuzmi podatke za ispis
            </Button>
          </div>
        </div>
      )}
      {document && (
        <iframe
          title="Pristupni podaci upisanih studenata"
          srcDoc={document}
          style={{
            position: "fixed",
            width: 1,
            height: 1,
            border: 0,
            left: -10000,
          }}
          onLoad={(e) => {
            const w = e.currentTarget.contentWindow;
            if (w) {
              w.addEventListener("afterprint", () => setDocument(null), {
                once: true,
              });
              w.focus();
              w.print();
            }
          }}
        />
      )}
    </section>
  );
}
