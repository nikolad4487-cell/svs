"use client";
import { useState } from "react";
import { Search, ArrowUpRight, Building2 } from "lucide-react";
import type { PublicInstitution } from "@/lib/institutions/public";
import { officialWebsite } from "@/lib/institutions/domains";
export function InstitutionDirectory({
  institutions,
  base,
}: {
  institutions: PublicInstitution[];
  base: string;
}) {
  const [query, setQuery] = useState(""),
    [onlyReview, setOnlyReview] = useState(false);
  const rows = institutions.filter(
    (i) =>
      (!onlyReview ||
        i.domain_verification_status === "requires_verification") &&
      `${i.name} ${i.registry_name} ${i.parent_name} ${i.headquarters} ${i.subdomain}`
        .toLocaleLowerCase("hr")
        .includes(query.toLocaleLowerCase("hr")),
  );
  return (
    <section id="ustanove" className="mx-auto max-w-7xl space-y-6 px-6 py-12">
      <div>
        <h2 className="text-3xl font-bold">Visoka učilišta</h2>
        <p className="mt-3 text-sm text-slate-500">
          Katalog ustanova u ovoj aplikaciji. Profil i poddomena ne
          predstavljaju službenu stranicu učilišta.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-300 bg-white px-4">
          <Search size={20} />
          <input
            aria-label="Pretraži ustanove po nazivu, gradu ili sveučilištu"
            placeholder="Naziv, grad ili sveučilište…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-3 outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyReview}
            onChange={(e) => setOnlyReview(e.target.checked)}
          />
          Čeka provjeru
        </label>
      </div>
      <p role="status" className="text-sm text-slate-500">
        Prikazano {rows.length} od {institutions.length} ustanova.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((i) => {
          const domain = new URL(base);
          domain.hostname = `${i.subdomain}.${domain.hostname}`;
          const official = officialWebsite(i.official_website);
          return (
            <article
              key={i.id}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <Building2 size={21} className="mt-1 shrink-0 text-blue-700" />
                <h3 className="font-bold leading-6">
                  <a href={domain.toString()}>{i.name}</a>
                </h3>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                {i.parent_name || "Samostalna ustanova"} ·{" "}
                {i.headquarters || "Sjedište nije potvrđeno"}
              </p>
              <p className="break-all text-sm text-blue-700">
                {i.subdomain}.isvu.me
              </p>
              {official ? (
                <a
                  href={official}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all text-xs underline"
                >
                  {i.official_website}
                </a>
              ) : (
                <p className="text-xs text-amber-800">
                  Službena web-adresa nije potvrđena.
                </p>
              )}
              <p
                className={`text-xs ${i.domain_verification_status === "requires_verification" ? "text-amber-800" : "text-slate-500"}`}
              >
                {i.domain_verification_status === "requires_verification"
                  ? "Oznaka / podaci čekaju provjeru administratora."
                  : "Metapodaci pregledani; DNS i HTTPS provjeravaju se zasebno."}
              </p>
              <a
                href={domain.toString()}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
              >
                Otvori profil ustanove
                <ArrowUpRight size={15} />
              </a>
            </article>
          );
        })}
      </div>
      {!institutions.length && (
        <p className="text-sm text-slate-500">
          Katalog još nije učitan ili migracija nije primijenjena.
        </p>
      )}
    </section>
  );
}
