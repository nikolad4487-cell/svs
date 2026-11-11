import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  websiteLabel,
  institutionInitials,
  asciiSlug,
  allocateSubdomain,
} from "../src/lib/institutions/domains.ts";
const source = readFileSync("data/institutions/125-source.psv", "utf8")
  .trim()
  .split("\n")
  .map((l) => l.split("|"));
if (source.length !== 125)
  throw Error(`Expected 125 source rows, got ${source.length}`);
const parents = {
  Z: "Sveučilište u Zagrebu",
  R: "Sveučilište u Rijeci",
  S: "Sveučilište u Splitu",
  O: "Sveučilište Josipa Jurja Strossmayera u Osijeku",
};
const examples = {
  10: "www.efzg.unizg.hr",
  16: "www.fer.unizg.hr",
  21: "www.fhs.unizg.hr",
  24: "www.foi.unizg.hr",
  93: "www.uniri.hr",
  97: "www.unizg.hr",
  117: "www.vuka.hr",
};
const enrichment = JSON.parse(
  readFileSync("data/institutions/verified-enrichment.json", "utf8"),
);
const provenance=JSON.parse(readFileSync("data/institutions/provenance.json","utf8"));
// Preserve only addresses explicitly requested earlier; all other bases are word initials.
const explicitLabels = {10:"efzg",16:"fer",21:"fhs",24:"foi",46:"geofzg",93:"uniri",97:"unizg",102:"ufzg",117:"vuka"};
const bases = source.map(([name], i) => explicitLabels[i+1] || institutionInitials(name));
const cityCodes = {Zagreb:"zg",Rijeka:"ri",Split:"st",Osijek:"os",Varaždin:"vz",Pula:"pu",Karlovac:"ka",Vukovar:"vu",Sisak:"sk",Šibenik:"si"};
const shortLabels = Object.fromEntries(source.map(([name, parent, city], i) => {
  let label = bases[i];
  if (!explicitLabels[i+1] && bases.filter(b=>b===label).length>1) {
    const sameCity = source.filter((r,j)=>bases[j]===label && r[2]===city).length>1;
    const qualifier = cityCodes[city] || institutionInitials(city);
    const distinctive = asciiSlug(name).split("-").find(word => !["fakultet", "veleuciliste", "sveuciliste", "akademija"].includes(word)) || name;
    label += "-" + qualifier + (sameCity ? "-" + distinctive.slice(0,4) : "");
  }
  return [`hr-isvu-125:${String(i+1).padStart(3,"0")}`, label];
}));
writeFileSync("data/institutions/short-labels.json", JSON.stringify(shortLabels,null,2)+"\n");
const used = new Set();
const rows = source.map(([name, parent, city], index) => {
  const n = index + 1,
    key = `hr-isvu-125:${String(n).padStart(3, "0")}`,
    extra = enrichment[key] || {};
  const website =
    Object.hasOwn(extra,"official_website") ? extra.official_website : (examples[n] ? `https://${examples[n]}` : null);
  const manual = explicitLabels[n] || null;
  const derived = website ? websiteLabel(website) : null;
  const proposed = shortLabels[key];
  const abbreviationCollision = !manual && bases.filter(b => b === bases[index]).length > 1;
  const allocated = allocateSubdomain(
    proposed,
    used,
    city || parent,
    String(n).padStart(3, "0"),
  );
  const digest = createHash("sha256").update(key).digest("hex");
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return {
    id,
    registry_key: key,
    isvu_institution_id: extra.isvu_institution_id || null,
    name: extra.name || name,
    parent_name: extra.parent_name ?? parents[parent] ?? null,
    headquarters: extra.city || city,
    address: extra.address || null,
    registry_contact_email: extra.contact_email ? extra.contact_email.replace(/^mailto:/i, "").split("?")[0] : null,
    registry_phone: extra.phone || null,
    official_website: website,
    website_source:
      website ? extra.website_source || "user_request_example" : null,
    website_verification_status: extra.verified && !!website
      ? "registry_reported"
      : "requires_verification",
    source_url:
      extra.source_url || "https://www.isvu.hr/visokaucilista/hr/pretrazivanje",
    subdomain: allocated.subdomain,
    domain_origin: n === 102
      ? "existing_application_route"
      : (derived && proposed === derived)
        ? "website_candidate"
        : "provisional_abbreviation",
    domain_verification_status:
      extra.verified && !!website && !allocated.collision && proposed === derived
        ? "registry_derived"
        : "requires_verification",
    domain_notes: allocated.collision || abbreviationCollision || (!!website && !derived)
      ? "Jednaka kratica ili rezervirana oznaka; dodana kratka oznaka grada ili razlikovne riječi. Službena web-adresa čeka provjeru."
      : n === 102
        ? "Očuvana postojeća oznaka UFZG; potrebna provjera izvora."
        : manual && !derived
        ? "Očuvana kratka oznaka izričito navedena u korisničkom zahtjevu; izvor čeka provjeru."
        : !website
          ? "Kratica od početnih slova naziva, bez veznika i prijedloga; službena web-adresa nije potvrđena."
          : extra.verified
            ? ""
            : "Web-adresa navedena kao primjer u korisničkom zahtjevu; registar još nije dohvaćen.",
    collision: allocated.collision || abbreviationCollision || (!!website && !derived),
    source_pdf: "visoka učilišta.pdf",
    source_pdf_sha256: provenance.sha256,
    source_record_origin: extra.record_verified
      ? "live_registry"
      : "user_pdf_and_list",
  };
});
for (const r of rows)
  r.parent_registry_key =
    rows.find((p) => p.name === r.parent_name)?.registry_key || null;
writeFileSync(
  "data/institutions/catalog-125.json",
  JSON.stringify(rows, null, 2) + "\n",
);
const bindings = {
  "hr-isvu-125:102": {
    id: "7cd83cb8-c7f3-4d74-a70f-cf9b410d1b22",
    expected_code: "UFZG",
    expected_slug: "ufzg",
    expected_headquarters: "Zagreb",
    reason:
      "Postojeća ustanova Učiteljski fakultet, Zagreb; očuvati id, članstva, korisnike i evidencije.",
  },
};
writeFileSync(
  "data/institutions/legacy-bindings.json",
  JSON.stringify(bindings, null, 2) + "\n",
);
const json = JSON.stringify(rows).replaceAll("'", "''");
const map = JSON.stringify(bindings).replaceAll("'", "''");
if (!existsSync("supabase/migrations/202611110003_institution_catalog_125.sql")) writeFileSync(
  "supabase/migrations/202611110003_institution_catalog_125.sql",
  `-- Idempotent source snapshot of the 125 requested institutions. No users or email domains are created.\n-- Source IDs/websites absent from the supplied PDF remain explicitly unverified.\nselect public.import_institution_catalog('${json}'::jsonb,'${map}'::jsonb);\n`,
);
const table = rows
  .map(
    (r) =>
      `| ${r.name}${r.parent_name ? " (" + r.parent_name + ")" : ""} | ${r.official_website || "Nije potvrđena"} | ${r.subdomain}.isvu.me | ${r.domain_verification_status}; ${r.domain_origin} |`,
  )
  .join("\n");
mkdirSync("reports", { recursive: true });
writeFileSync(
  "reports/visoka-ucilista-125.md",
  `# Izvještaj o 125 visokih učilišta\n\nIzvor: korisnikov PDF i popis, 11. 11. 2026. ${rows.every(r=>r.source_record_origin!=="live_registry")?"Pristup službenom registru trenutno blokira mrežna politika okruženja.":"Izvori su navedeni uz svaku ustanovu; nepotpuni zapisi ostaju označeni za provjeru."} Oznake nisu potvrda DNS-a, HTTPS-a niti pripadnosti aplikacije ustanovi.\n\nUkupno: ${rows.length}. Potvrđene web-adrese iz živog registra: ${rows.filter((r) => r.website_verification_status === "registry_reported").length}. Nedostajuće web-adrese: ${rows.filter((r) => !r.official_website).length}. Nepotvrđene web-adrese iz primjera: ${rows.filter((r) => r.official_website && r.website_verification_status === "requires_verification").length}. Kolizije/prilagođene oznake: ${rows.filter((r) => r.collision).length}. Nedostajući službeni ISVU identifikatori: ${rows.filter((r) => !r.isvu_institution_id).length}.\n\n| Naziv ustanove | Službena web-adresa | Poddomena ISVU aplikacije | Status provjere |\n|---|---|---|---|\n${table}\n\n## Iznimke i kolizije\n\n${rows
    .filter(
      (r) => r.collision || r.domain_origin === "existing_application_route",
    )
    .map(
      (r) =>
        `- ${r.registry_key}: ${r.name} — ${r.subdomain}.isvu.me. ${r.domain_notes}`,
    )
    .join(
      "\n",
    )}\n\n## Neprovedeni koraci\n\n- Dohvat pojedinačnih službenih zapisa i identifikatora iz ISVU registra, službenih URL-ova i kontakata; mrežni nacrt čeka spremanje i objavu okruženja.\n- Administratorska potvrda svih privremenih oznaka i neprovjerenih adresa.\n- Primjena migracija i uvoza u produkcijski Supabase; lokalni testovi to ne zamjenjuju.\n- Vercel wildcard domena, DNS, HTTPS i provjera javnih poddomena.\n`,
);
const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
writeFileSync("reports/visoka-ucilista-125.csv", "\ufeff" + [
  ["Naziv ustanove", "Nadređeno sveučilište", "Službena web-adresa", "Poddomena ISVU aplikacije", "Status provjere", "Izvor", "ISVU identifikator", "Napomena"],
  ...rows.map(r => [r.name, r.parent_name, r.official_website, `${r.subdomain}.isvu.me`, `${r.domain_verification_status}; ${r.domain_origin}`, r.source_url, r.isvu_institution_id, r.domain_notes]),
].map(row => row.map(csvCell).join(";")).join("\n") + "\n");
console.log(
  `Generated ${rows.length} unique catalog records; official metadata remains explicitly unverified where absent.`,
);
