import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Mail,
  LibraryBig,
  Files,
  CalendarDays,
  KeyRound,
  ShieldCheck,
  LayoutDashboard,
  Globe,
  LockKeyhole,
  Layers,
} from "lucide-react";
import { modules } from "@/lib/modules";
import { navigation } from "@/lib/context";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
const icons = {
  BookOpen,
  GraduationCap,
  Mail,
  LibraryBig,
  Files,
  CalendarDays,
  KeyRound,
  ShieldCheck,
  LayoutDashboard,
};
export default async function Home() {
  const url = await navigation();
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <a href={url("home")} aria-label="SVS početna">
            <Brand />
          </a>
          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#moduli">Moduli sustava</a>
            <a href="#o-sustavu">O platformi</a>
            <a href="#podrska">Podrška</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild size="sm">
              <a href={url("auth")}>
                Prijava <ArrowRight size={15} />
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute -right-28 top-0 h-96 w-96 rounded-full bg-blue-500/5" />
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-700">
                POVEZANO ZNANJE. JEDNOSTAVNIJI STUDIJ.
              </span>
              <h1 className="mt-7 max-w-2xl text-4xl font-bold leading-[1.14] tracking-tight sm:text-6xl">
                Vaš akademski svijet.
                <br />
                <span className="text-blue-700">Na jednom mjestu.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-500">
                Jedinstven prostor za studente, nastavnike i visoka učilišta. Od
                prvog predavanja do posljednjeg ispita.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <a href="#moduli">
                    Istražite module <ArrowRight size={17} />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href="#o-sustavu">Upoznajte platformu</a>
                </Button>
              </div>
              <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
                <LockKeyhole size={14} /> Izgrađeno za hrvatsko visoko
                obrazovanje
              </p>
            </div>
            <div className="relative self-center rounded-2xl border border-slate-200 bg-slate-50 p-7">
              <div className="mb-7 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Povezan akademski ekosustav
                </span>
                <Layers className="text-blue-600" size={21} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: GraduationCap,
                    title: "Studenti",
                    text: "Sve za vaš studij",
                  },
                  {
                    icon: BookOpen,
                    title: "Nastavnici",
                    text: "Prostor za znanje",
                  },
                  {
                    icon: LibraryBig,
                    title: "Ustanove",
                    text: "Jednostavnije upravljanje",
                  },
                  {
                    icon: Globe,
                    title: "Zajednica",
                    text: "Zajednička platforma",
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <Icon className="mb-5 text-blue-600" size={25} />
                    <h2 className="text-sm font-bold">{title}</h2>
                    <p className="mt-2 text-xs text-slate-500">{text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs leading-5 text-slate-500">
                Razvojno izdanje · Moduli su dostupni za pregled. Povezivanje
                podataka slijedi u idućim fazama.
              </p>
            </div>
          </div>
        </section>
        <section id="moduli" className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-blue-700">
                Vaš digitalni kampus
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                Sve što trebate za akademski dan
              </h2>
              <p className="mt-3 text-slate-500">
                Odaberite modul i otvorite svoj prostor za rad.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              9 povezanih modula
            </span>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((m) => {
              const Icon = icons[m.icon];
              return (
                <a
                  key={m.slug}
                  href={url(m.slug)}
                  className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
                      <Icon size={24} />
                    </span>
                    <ArrowUpRight
                      size={20}
                      className="text-slate-400 group-hover:text-blue-700"
                    />
                  </div>
                  <h3 className="mt-6 text-lg font-bold">{m.name}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                    {m.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
                    <span className="flex items-center gap-2 text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Razvojno izdanje
                    </span>
                    <span className="font-semibold text-blue-700">
                      Otvori modul
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
        <section id="o-sustavu" className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold">
                Jedna platforma, više mogućnosti.
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-slate-500">
                SVS je modularni informacijski sustav za sveučilišta, fakultete,
                veleučilišta i akademije. Zajednički vizualni identitet povezuje
                zasebne prostore za studij, nastavu i administraciju.
              </p>
            </div>
            <div id="podrska" className="rounded-xl bg-slate-50 p-6">
              <h2 className="font-bold">Kontakt i tehnička podrška</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Kontakt podrške još nije konfiguriran. Za pitanja o pristupu
                obratite se administratoru svoje ustanove. Stvarna dostupnost
                vanjskih usluga bit će prikazana nakon povezivanja.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-xs text-slate-500">
        <span>SVS · Sustav visokog obrazovanja</span>
        <span>Razvojna platforma · Nije službeni ISVU ni Merlin servis</span>
      </footer>
    </>
  );
}
