"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "./forms";
import {
  credentialPrintDocument,
  type CredentialSheet,
} from "@/lib/admin/credential-print";
type Flow = {
  id: string;
  institution_id: string;
  program_id: string;
  academic_year_id: string;
  domain: string;
  matura_required: boolean;
  requirements_reference: string;
};
type Catalog = {
  mappings: Flow[];
  institutions: { id: string; name: string; email_domains: string[] }[];
  targetPrograms: { id: string; institution_id: string; name: string }[];
  targetYears: { id: string; institution_id: string; name: string }[];
};
type Pupil = {
  candidate_id: string;
  full_name: string;
  school_name: string;
  eligible: boolean;
  reasons: string[];
  job: string | null;
  review: {
    matura_verified: boolean;
    conditions_verified: boolean;
    admission_approved: boolean;
    evidence_reference: string;
  } | null;
};
type Issued = { user_id: string; credentials: CredentialSheet };
async function call(action: string, body: unknown) {
  const response = await fetch(`/api/admissions/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Postupak nije uspio.");
  return data;
}
export function FirstEnrollment() {
  const [editing, setEditing] = useState<Flow | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [institution, setInstitution] = useState(""),
    [flowId, setFlowId] = useState(""),
    [rows, setRows] = useState<Pupil[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [loaded, setLoaded] = useState(false);
  const [issued, setIssued] = useState<Issued[]>([]),
    [loginUrl, setLoginUrl] = useState(""),
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
  const load = async () => setCatalog(await call("target-catalog", {}));
  const preview = async (id = flowId) => {
    const data = await call("preview", { mapping_id: id });
    setRows(data.rows);
    setSelected([]);
    setLoaded(true);
  };
  const flow = catalog?.mappings.find((f) => f.id === flowId);
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold">Prvi upis učenika na fakultet</h2>
      <p>
        Ovdje administrator provodi prvi fakultetski upis u ISVU. Učenik dolazi
        iz evidencije završetka srednje škole u e-Matici. Ne treba prethodno
        biti upisan na fakultet u drugoj aplikaciji.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Odaberi učilište, studij i akademsku godinu u ISVU-u.</li>
        <li>Dohvati završene učenike iz e-Matice.</li>
        <li>Provjeri maturu i uvjete programa te odobri prvi upis.</li>
        <li>Upiši odabrane učenike i ispiši početne pristupne podatke.</li>
      </ol>
      <Button disabled={busy} onClick={() => run(load)}>
        Učitaj učilišta i studije iz ISVU-a
      </Button>
      <p className="text-sm text-slate-500">
        Priprema upisnog postupka radi neovisno o ponudi fakulteta u e-Matici.
        Stvarne upise provodite tek nakon završetka škole, potrebne mature i
        provjere uvjeta.
      </p>
      {message && (
        <p role="status" className="rounded-lg border bg-amber-50 p-4 text-sm">
          {message}
        </p>
      )}
      {catalog && (
        <>
          <details open className="rounded-xl border p-5">
            <summary className="cursor-pointer font-semibold">
              1. Pripremi prvi upis na studij
            </summary>
            <form
              key={editing?.id || "new"}
              className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () => {
                  const saved = await call("first-mapping", {
                    ...(editing ? { id: editing.id } : {}),
                    institution_id: institution,
                    program_id: f.get("program_id"),
                    academic_year_id: f.get("academic_year_id"),
                    domain: f.get("domain"),
                    matura_required: f.has("matura_required"),
                    requirements_reference: f.get("requirements_reference"),
                    enabled: true,
                  });
                  await load();
                  setEditing(null);
                  setFlowId(saved.id);
                  setRows([]);
                  setLoaded(false);
                  setMessage(
                    "Upisni postupak je spremljen. Sada možete dohvatiti učenike iz e-Matice.",
                  );
                });
              }}
            >
              <label>
                Učilište
                <select
                  aria-label="Učilište"
                  required
                  className={inputClass}
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                >
                  <option value="">Odaberite učilište…</option>
                  {catalog.institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Studijski program
                <select
                  aria-label="Studijski program"
                  required
                  className={inputClass}
                  name="program_id"
                  defaultValue={editing?.program_id || ""}
                  key={`p-${institution}`}
                >
                  <option value="">Odaberite studij…</option>
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
                Akademska godina upisa
                <select
                  aria-label="Akademska godina upisa"
                  required
                  className={inputClass}
                  name="academic_year_id"
                  defaultValue={editing?.academic_year_id || ""}
                  key={`y-${institution}`}
                >
                  <option value="">Odaberite godinu…</option>
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
                Domena novih korisničkih imena
                <select
                  aria-label="Domena novih korisničkih imena"
                  required
                  className={inputClass}
                  name="domain"
                  defaultValue={editing?.domain || ""}
                  key={`d-${institution}`}
                >
                  <option value="">Odaberite domenu…</option>
                  {catalog.institutions
                    .find((i) => i.id === institution)
                    ?.email_domains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </select>
              </label>
              <label className="sm:col-span-2">
                Naziv postupka / pravilo prvog upisa
                <input
                  required
                  minLength={3}
                  maxLength={500}
                  name="requirements_reference"
                  defaultValue={editing?.requirements_reference || ""}
                  className={inputClass}
                  placeholder="Npr. Prvi upis na Učiteljski studij 2027./2028."
                />
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="matura_required"
                  defaultChecked={editing?.matura_required ?? true}
                />
                Studij zahtijeva položenu maturu. Izuzeće mora imati
                dokumentiranu osnovu u pravilima upisa.
              </label>
              <Button disabled={busy}>Spremi upisni postupak</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setInstitution("");
                }}
              >
                Novi postupak
              </Button>
            </form>
          </details>
          <section className="space-y-4">
            <h3 className="font-semibold">
              2. Odaberi postupak i dohvati učenike
            </h3>
            <label className="block min-w-0">
              Upisni postupak
              <select
                aria-label="Upisni postupak"
                className={inputClass}
                value={flowId}
                onChange={(e) => {
                  setFlowId(e.target.value);
                  setRows([]);
                  setSelected([]);
                  setLoaded(false);
                }}
              >
                <option value="">Odaberite spremljeni postupak…</option>
                {catalog.mappings.map((f) => (
                  <option key={f.id} value={f.id}>
                    {
                      catalog.institutions.find(
                        (i) => i.id === f.institution_id,
                      )?.name
                    }{" "}
                    ·{" "}
                    {
                      catalog.targetPrograms.find((p) => p.id === f.program_id)
                        ?.name
                    }{" "}
                    ·{" "}
                    {
                      catalog.targetYears.find(
                        (y) => y.id === f.academic_year_id,
                      )?.name
                    }
                  </option>
                ))}
              </select>
            </label>
            {flow && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(flow);
                  setInstitution(flow.institution_id);
                }}
              >
                Uredi odabrani postupak
              </Button>
            )}
            <Button
              disabled={busy || !flowId}
              onClick={() => run(() => preview())}
            >
              Dohvati završene učenike iz e-Matice
            </Button>
            {loaded && !rows.length && (
              <p className="rounded-lg bg-blue-50 p-4 text-sm">
                U e-Matici još nema evidentiranih završenih učenika srednjih
                škola za ovaj postupak. To je očekivano prije završetka
                školovanja. Upisni postupak u ISVU-u je pripremljen; ne trebate
                kreirati izvorni fakultet ili fakultetski program u e-Matici.
              </p>
            )}
            {rows.length > 0 && (
              <label className="block">
                Traži učenika
                <input
                  type="search"
                  className={inputClass}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            )}
            {rows
              .filter((r) =>
                r.full_name
                  .toLocaleLowerCase("hr")
                  .includes(search.toLocaleLowerCase("hr")),
              )
              .map((row) => (
                <article
                  key={row.candidate_id}
                  className="rounded-xl border p-5"
                >
                  <label className="flex gap-3 font-semibold">
                    <input
                      type="checkbox"
                      disabled={
                        busy ||
                        !row.eligible ||
                        ["completed", "running"].includes(row.job || "")
                      }
                      checked={selected.includes(row.candidate_id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, row.candidate_id]
                            : ids.filter((id) => id !== row.candidate_id),
                        )
                      }
                    />
                    {row.full_name} ·{" "}
                    {row.job === "completed"
                      ? "Već upisan"
                      : row.job === "running"
                        ? "Upis je u tijeku"
                        : row.eligible
                          ? "Spreman za prvi upis"
                          : "Potrebna provjera"}
                  </label>
                  <p className="my-2 text-sm">
                    {row.school_name} · Završetak srednje škole evidentiran u
                    e-Matici.
                  </p>
                  {row.reasons.length > 0 && (
                    <ul className="list-disc pl-5 text-sm">
                      {row.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {row.job !== "completed" && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-blue-700">
                        3. Provjeri uvjete i odobri prvi upis
                      </summary>
                      <form
                        className="mt-4 space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          run(async () => {
                            await call("review", {
                              mapping_id: flowId,
                              candidate_id: row.candidate_id,
                              graduation_verified: false,
                              matura_verified: f.has("matura_verified"),
                              conditions_verified: f.has("conditions_verified"),
                              admission_approved: f.has("admission_approved"),
                              evidence_reference: f.get("evidence_reference"),
                            });
                            await preview();
                            setMessage(
                              "Provjera i odluka su evidentirane. Za provedbu upisa odaberite učenika i kliknite Upiši.",
                            );
                          });
                        }}
                      >
                        {flow?.matura_required && (
                          <label className="flex gap-2">
                            <input
                              type="checkbox"
                              name="matura_verified"
                              defaultChecked={row.review?.matura_verified}
                            />
                            Provjerio sam da je potrebna matura položena.
                          </label>
                        )}
                        <label className="flex gap-2">
                          <input
                            type="checkbox"
                            name="conditions_verified"
                            defaultChecked={row.review?.conditions_verified}
                          />
                          Provjerio sam uvjete ovog studijskog programa.
                        </label>
                        <label className="flex gap-2">
                          <input
                            type="checkbox"
                            name="admission_approved"
                            defaultChecked={row.review?.admission_approved}
                          />
                          Odobravam prvi upis ovog učenika na odabrani studij.
                        </label>
                        <label>
                          Oznaka odluke / dokumenta provjere
                          <input
                            required
                            minLength={3}
                            maxLength={1000}
                            name="evidence_reference"
                            className={inputClass}
                            defaultValue={row.review?.evidence_reference || ""}
                          />
                        </label>
                        <Button disabled={busy}>
                          Spremi provjeru i odobrenje
                        </Button>
                      </form>
                    </details>
                  )}
                </article>
              ))}
            <Button
              disabled={busy || !selected.length || selected.length > 5}
              onClick={() =>
                run(async () => {
                  const data = await call("apply", {
                    mapping_id: flowId,
                    candidates: selected,
                  });
                  setIssued((prev) => [
                    ...prev,
                    ...data.results.filter(
                      (r: { credentials?: CredentialSheet }) => r.credentials,
                    ),
                  ]);
                  setLoginUrl(data.loginUrl);
                  await preview();
                  setMessage(
                    `Dovršeni upisi: ${data.results.filter((r: { status: string }) => r.status === "completed").length}; neuspjeli: ${data.results.filter((r: { status: string }) => r.status === "failed").length}. Sačuvajte izdane pristupne podatke.`,
                  );
                })
              }
            >
              4. Upiši odabrane učenike u ISVU ({selected.length}/5)
            </Button>
          </section>
        </>
      )}
      {issued.length > 0 && (
        <section className="rounded-xl border bg-blue-50 p-5">
          <h3 className="font-semibold">Podaci za prvu prijavu</h3>
          <p>
            Novi računi: {issued.length}. Postojeće lozinke nisu promijenjene.
            Ispišite ili preuzmite podatke prije napuštanja stranice.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
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
                const text = issued
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
                  new Blob([text], { type: "application/x-ndjson" }),
                );
                const a = window.document.createElement("a");
                a.href = url;
                a.download = "prvi-upis-pristupni-podaci.jsonl";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Preuzmi pristupne podatke
            </Button>
          </div>
        </section>
      )}
      {document && (
        <iframe
          title="Podaci za prvi upis"
          srcDoc={document}
          style={{
            position: "fixed",
            left: -10000,
            width: 1,
            height: 1,
            border: 0,
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
