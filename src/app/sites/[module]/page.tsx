import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { identity } from "@/lib/auth/access";
import { canAccessModule } from "@/lib/auth/policy";
import { supabaseConfig } from "@/lib/supabase/config";
import { AuthPanel, ConfigNotice } from "@/components/auth/auth-panel";
import { AcademicWorkspace } from "@/components/academic/workspace";
import { AdmissionImport } from "@/components/auth/admission-import";
import { Institutions } from "@/components/auth/institutions";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ExternalService } from "@/components/external-service";
import { LearningWorkspace } from "@/components/learning/workspace";
import { LearningShell } from "@/components/learning/shell";
import { modules, academicAdminItems, studomatGroups } from "@/lib/modules";
import { navigation } from "@/lib/context";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
export function generateStaticParams() {
  return modules.map((m) => ({ module: m.slug }));
}
export default async function Module({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{
    view?: string;
    mode?: string;
    status?: string;
    next?: string;
    institution?: string;
    date?: string;
    course?: string;
    academic_year?: string;
    student?: string;
    faculty?: string;
  }>;
}) {
  const { module } = await params;
  const faculty = (await headers()).get("x-svs-faculty") || undefined;
  const m = modules.find((m) => m.slug === module);
  if (!m) notFound();
  const {
    view,
    mode,
    status,
    next,
    institution,
    date,
    course,
    academic_year,
    student,
    faculty: loginFaculty,
  } = await searchParams;
  const active = m.items.find((i) => i === view) || m.items[0];
  const url = await navigation();
  const account = await identity();
  if (module !== "auth" && supabaseConfig() && !account) {
    const target = new URL(url("auth"));
    target.searchParams.set("next", m.slug);
    if (faculty) target.searchParams.set("faculty", faculty);
    redirect(target.toString());
  }
  const allowed =
    module === "auth" ||
    (!!account &&
      canAccessModule(m.slug, account.superadmin, account.memberships));
  if (
    institution &&
    module !== "auth" &&
    account &&
    !account.superadmin &&
    !account.memberships.some((m) => m.institution_id === institution)
  )
    notFound();
  const copy: Record<string, string> = {
    portal:
      "Osobni podaci, kolegiji i obavijesti bit će dostupni nakon povezivanja korisničkog računa.",
    studomat:
      "Pregled upisanih kolegija, ECTS bodova i prijava ispita zahtijeva prijavu i povezivanje studijskih evidencija.",
    merlin:
      "Prostor za nastavne materijale, predaje i kvizove. Ovo je vlastiti modul e-učenja, a ne službeni Merlin ili Moodle instalacija.",
    webmail:
      "Pružatelj e-pošte nije povezan. Administrator treba konfigurirati Microsoft 365 ili Zoho Mail i ovlastiti pristup poštanskim sandučićima. Poruke se ne prikazuju dok integracija nije aktivna.",
    isvu: "Upravljanje studijskim evidencijama bit će omogućeno ovlaštenim djelatnicima. Ovaj modul nije povezan sa službenim ISVU-om.",
    referada:
      "Zahtjevi za potvrde i komunikacija s referadom zahtijevaju provjeren korisnički račun.",
    raspored:
      "Raspored će prikazivati termine prema ustanovi, upisanim kolegijima i nastavnim grupama. Još nema povezanih termina.",
    auth: "Centralna autentifikacija bit će povezana sa Supabase Authom u drugoj fazi. Prijava, registracija i reset lozinke trenutačno nisu omogućeni.",
    admin:
      "Administracija je namijenjena isključivo superadministratorima. Ovo je javna informativna stranica modula; nema pristupa administrativnim podacima ili radnjama.",
  };
  if (module === "merlin" && supabaseConfig() && allowed)
    return (
      <LearningShell
        active={active}
        courseId={course}
        name={account?.profile.full_name || "Moj račun"}
      >
        <LearningWorkspace courseId={course} view={active} status={status} />
      </LearningShell>
    );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-6">
        <a href={url("home")}>
          <Brand />
        </a>
        <p className="mb-4 mt-10 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {m.name}
        </p>
        <nav className="flex flex-wrap gap-2 lg:block">
          {m.slug === "studomat"
            ? Object.entries(studomatGroups).map(([group, items]) => (
                <details
                  key={group}
                  open={items.some((item) => item === active)}
                  className="mb-3"
                >
                  <summary className="cursor-pointer py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {group}
                  </summary>
                  {items.map((item) => (
                    <a
                      key={item}
                      href={`${url(m.slug)}${url(m.slug).includes("?") ? "&" : "?"}view=${encodeURIComponent(item)}${institution ? `&institution=${encodeURIComponent(institution)}` : ""}`}
                      aria-current={active === item ? "page" : undefined}
                      className={`mb-1 block rounded-lg px-3 py-2 text-sm ${active === item ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      {item}
                    </a>
                  ))}
                </details>
              ))
            : m.items.map((item) => (
                <a
                  key={item}
                  href={`${url(m.slug)}${url(m.slug).includes("?") ? "&" : "?"}view=${encodeURIComponent(item)}${institution ? `&institution=${encodeURIComponent(institution)}` : ""}${module === "merlin" && course ? `&course=${encodeURIComponent(course)}` : ""}`}
                  aria-current={active === item ? "page" : undefined}
                  className={`mb-2 block rounded-lg px-3 py-3 text-sm ${active === item ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  {item}
                </a>
              ))}
        </nav>
        <div className="mt-8 border-t border-slate-200 pt-5">
          <a
            href={url("home")}
            className="flex items-center gap-2 text-sm text-slate-500"
          >
            <ArrowLeft size={16} /> Svi moduli
          </a>
        </div>
      </aside>
      <div>
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 md:px-10">
          <span className="text-sm text-slate-500">
            Digitalni kampus /{" "}
            <strong className="text-slate-800">{m.name}</strong>
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {module !== "auth" && (
              <Button asChild size="sm">
                <a href={url("auth")}>
                  {account ? "Moj račun" : "Prijava"} <ArrowRight size={14} />
                </a>
              </Button>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6 md:p-10">
          <div className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            {m.slug}.isvu
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {m.name}
          </h1>
          <p className="mt-3 text-slate-500">{m.description}</p>
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 md:p-10">
            {module === "auth" ? (
              <AuthPanel
                mode={mode}
                status={status}
                next={next}
                faculty={loginFaculty}
              />
            ) : !supabaseConfig() ? (
              <ConfigNotice />
            ) : !allowed ? (
              <div role="alert">
                <h2 className="text-xl font-bold">Pristup nije dopušten</h2>
                <p className="mt-3 text-slate-500">
                  Nemate potrebnu ulogu za ovaj modul. Podaci nisu učitani.
                </p>
              </div>
            ) : module === "admin" && active === "Uvoz upisa" ? (
              <AdmissionImport />
            ) : module === "admin" &&
              !academicAdminItems.some((item) => item === active) ? (
              <Institutions system status={status} />
            ) : [
                "portal",
                "studomat",
                "isvu",
                "raspored",
                "admin",
                "referada",
              ].includes(module) ? (
              <AcademicWorkspace
                module={m.slug}
                view={active}
                status={status}
                institution={institution}
                date={date}
                courseId={course}
                academicYear={academic_year}
                studentId={student}
                faculty={faculty}
              />
            ) : module === "merlin" ? (
              <LearningWorkspace
                courseId={course}
                view={active}
                status={status}
              />
            ) : module === "webmail" ? (
              <ExternalService
                module={module}
                administrator={!!account?.superadmin}
              />
            ) : (
              <p>{copy[module]}</p>
            )}
          </div>
          <section className="mt-10">
            <h2 className="mb-4 text-sm font-semibold text-slate-500">
              Prijeđite u drugi modul
            </h2>
            <div className="flex flex-wrap gap-2">
              {modules
                .filter((other) => other.slug !== module)
                .map((other) => (
                  <a
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:border-blue-400"
                    key={other.slug}
                    href={url(other.slug)}
                  >
                    {other.name}
                  </a>
                ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
