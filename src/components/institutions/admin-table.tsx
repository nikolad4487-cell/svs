"use client";
import { useState } from "react";
import type { RegistryRow } from "./admin";
const input =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
export function RegistryAdminTable({ rows }: { rows: RegistryRow[] }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState("");
  const visible = rows.filter(
    (r) =>
      `${r.name} ${r.headquarters} ${r.parent_name} ${r.subdomain} ${r.isvu_institution_id}`
        .toLocaleLowerCase("hr")
        .includes(query.toLocaleLowerCase("hr")) &&
      (filter === "all" ||
        (filter === "review" &&
          r.domain_verification_status === "requires_verification") ||
        (filter === "missing" && !r.official_website) ||
        (filter === "collision" && r.source_snapshot.collision) ||
        (filter === "inactive" && !r.active)),
  );
  const row = rows.find((r) => r.id === selected);
  const field = (name: keyof RegistryRow, label: string, maxLength = 200) => (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        className={input}
        defaultValue={String(row?.[name] || "")}
        required={["name", "subdomain"].includes(name)}
        maxLength={maxLength}
      />
    </label>
  );
  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <h2 className="text-xl font-bold">
        Katalog visokih učilišta i poddomene
      </h2>
      <p className="text-sm text-slate-500">
        Iz zadanog popisa:{" "}
        {rows.filter((r) => r.registry_key?.startsWith("hr-isvu-125:")).length}
        /125. Ukupno ustanova: {rows.length}. Poddomene i podaci označeni kao
        neprovjereni nisu potvrda DNS-a, HTTPS-a ni službenog povezivanja.
      </p>
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Pretraži administraciju ustanova"
          className={`${input} min-w-0 flex-1`}
          placeholder="Naziv, grad, sveučilište ili poddomena…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Status podataka ustanova"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${input} w-auto`}
        >
          <option value="all">Sve ustanove</option>
          <option value="review">Čeka provjeru</option>
          <option value="missing">Nedostaje web-adresa</option>
          <option value="collision">Kolizije oznaka</option>
          <option value="inactive">Neaktivne ustanove</option>
        </select>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              {[
                "Ustanova",
                "Grad / sveučilište",
                "Web-adresa",
                "Poddomena",
                "Provjera",
                "",
              ].map((h, i) => (
                <th key={i} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="p-3 font-semibold">
                  {r.name}
                  {!r.active && " · Neaktivna"}
                </td>
                <td className="p-3">
                  {r.headquarters}
                  <br />
                  {r.parent_name || "—"}
                </td>
                <td className="max-w-48 break-all p-3">
                  {r.official_website || "Nije potvrđena"}
                </td>
                <td className="p-3">
                  {r.subdomain ? `${r.subdomain}.isvu.me` : "Nije dodijeljena"}
                </td>
                <td className="p-3">
                  {r.domain_verification_status}
                  {r.source_snapshot.collision ? " · Kolizija" : ""}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    className="font-bold text-blue-700"
                  >
                    Uredi metapodatke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {row && (
        <form
          key={row.id + row.updated_at}
          action="/api/admin/registry"
          method="post"
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2"
        >
          <h3 className="font-bold md:col-span-2">Uredi: {row.name}</h3>
          <input type="hidden" name="institution_id" value={row.id} />
          <input type="hidden" name="updated_at" value={row.updated_at} />
          {field("name", "Naziv ustanove")}
          {field("short_name", "Kratki naziv", 100)}
          {field("headquarters", "Sjedište")}
          {field("address", "Adresa", 1000)}
          {field(
            "official_website",
            "Službena web-adresa (HTTP ili HTTPS)",
            2048,
          )}
          {field("subdomain", "Poddomena (bez .isvu.me)", 63)}
          <label className="text-sm font-semibold">
            Provjera web-adrese
            <select
              name="website_verification_status"
              className={input}
              defaultValue={
                row.website_verification_status === "registry_reported"
                  ? "admin_verified"
                  : row.website_verification_status
              }
            >
              <option value="requires_verification">Potrebna provjera</option>
              <option value="admin_verified">
                Administrator potvrdio izvor
              </option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Provjera oznake poddomene
            <select
              name="domain_verification_status"
              className={input}
              defaultValue={
                row.domain_verification_status === "registry_derived"
                  ? "admin_verified"
                  : row.domain_verification_status
              }
            >
              <option value="requires_verification">Potrebna provjera</option>
              <option value="admin_verified">
                Administrator potvrdio oznaku
              </option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Nadređena ustanova
            <select
              name="parent_institution_id"
              className={input}
              defaultValue={row.parent_institution_id || ""}
            >
              <option value="">Bez povezanog zapisa</option>
              {rows
                .filter((i) => i.id !== row.id)
                .map((i) => (
                  <option value={i.id} key={i.id}>
                    {i.name} · {i.headquarters}
                  </option>
                ))}
            </select>
          </label>
          {field("domain_notes", "Napomena o oznaci / izvoru", 2000)}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={row.active} />
            Ustanova je aktivna
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="registry_metadata_locked"
              defaultChecked={true}
            />
            Zaštiti ručno potvrđene podatke od budućeg uvoza
          </label>
          <p className="text-xs text-slate-500 md:col-span-2">
            Promjena poddomene ne mijenja postojeću oznaku rasporeda. Potvrda
            ovdje odnosi se na metapodatke; stanje DNS-a i certifikata
            provjerite u Vercelu. Korisničke domene e-pošte i ovlasti uređuju se
            u postojećem dijelu ispod.
          </p>
          <button className="w-fit rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            Spremi metapodatke ustanove
          </button>
          <button
            type="button"
            className="w-fit text-sm text-slate-500"
            onClick={() => setSelected("")}
          >
            Zatvori uređivanje
          </button>
          <details className="md:col-span-2">
            <summary className="cursor-pointer text-sm">
              Posljednji izvorni zapis i podaci o povezivanju
            </summary>
            <p className="mt-3 text-xs">
              Izvorni ključ: {row.registry_key || "—"} · Službeni ISVU ID:{" "}
              {row.isvu_institution_id || "Nije potvrđen"}
            </p>
            <pre className="mt-3 max-h-80 overflow-auto text-xs">
              {JSON.stringify(row.source_snapshot, null, 2)}
            </pre>
          </details>
        </form>
      )}
    </section>
  );
}
