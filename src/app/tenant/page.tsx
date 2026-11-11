import { notFound } from "next/navigation";
import { requestContext } from "@/lib/auth/request";
import { institutionDirectory } from "@/lib/institutions/public";
import { identity } from "@/lib/auth/access";
import { canAccessModule } from "@/lib/auth/policy";
import { modules } from "@/lib/modules";
import { institutionUrl } from "@/lib/routes";
import { officialWebsite } from "@/lib/institutions/domains";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
export default async function Tenant() {
  const { host, url } = await requestContext();
  if (!host.tenantSlug) notFound();
  const [institution] = await institutionDirectory(host.tenantSlug);
  if (!institution) notFound();
  const account = await identity();
  const member =
    !!account &&
    (account.superadmin ||
      account.memberships.some((m) => m.institution_id === institution.id));
  const login = new URL(url("auth"));
  login.searchParams.set("next", "portal");
  login.searchParams.set("institution", institution.id);
  const official = officialWebsite(institution.official_website);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <a href={url("home")}>
            <Brand />
          </a>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 md:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Profil ustanove u aplikaciji ISVU
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
            {institution.name}
          </h1>
          <p className="mt-4 text-slate-500">
            {institution.parent_name || "Samostalna ustanova"} ·{" "}
            {institution.headquarters}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Ovo je neovisna aplikacija. Profil ne potvrđuje službeno povezivanje
            s visokim učilištem ili državnim ISVU-om.
          </p>
          {institution.domain_verification_status ===
            "requires_verification" && (
            <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              Poddomena ili izvorni podaci čekaju administratorsku provjeru.{" "}
              {institution.domain_notes}
            </p>
          )}
          {(institution.address||institution.registry_contact_email||institution.registry_phone)&&<address className="mt-5 space-y-2 text-sm not-italic text-slate-500">{institution.address&&<p>{institution.address}</p>}{institution.registry_contact_email&&<a className="block underline" href={"mailto:"+institution.registry_contact_email}>{institution.registry_contact_email}</a>}{institution.registry_phone&&<p>{institution.registry_phone}</p>}</address>}
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={login.toString()}
              className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white"
            >
              {account
                ? "Moj račun i prijava za ustanovu"
                : "Prijava za ovu ustanovu"}
            </a>
            {official && (
              <a
                href={official}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm"
              >
                Vanjska web-adresa ustanove
                {institution.website_verification_status ===
                "requires_verification"
                  ? " (neprovjerena)"
                  : ""}
              </a>
            )}
            {institution.source_url && (
              <a
                href={institution.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-3 text-sm text-blue-700 underline"
              >
                Izvor podataka
              </a>
            )}
          </div>
        </section>
        {account && !member && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
          >
            Vaš račun nema ovlasti za ovu ustanovu. Otvaranje njezine poddomene
            ne dodjeljuje članstvo ni pristup podacima.
          </p>
        )}
        {member && (
          <section>
            <h2 className="mb-5 text-2xl font-bold">Vaši moduli ustanove</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules
                .filter(
                  (m) =>
                    m.slug !== "auth" &&
                    canAccessModule(
                      m.slug,
                      account!.superadmin,
                      account!.memberships.filter(
                        (x) => x.institution_id === institution.id,
                      ),
                    ),
                )
                .map((m) => (
                  <a
                    href={institutionUrl(url(m.slug), institution.id)}
                    key={m.slug}
                    className="rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <h3 className="font-bold text-blue-700">{m.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {m.description}
                    </p>
                  </a>
                ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
