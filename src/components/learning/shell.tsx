import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  FileText,
  ClipboardList,
  CircleHelp,
  BarChart3,
  CalendarDays,
  ArrowLeft,
  UserRound,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { navigation } from "@/lib/context";

export async function LearningShell({
  active,
  courseId,
  name,
  children,
}: {
  active: string;
  courseId?: string;
  name: string;
  children: React.ReactNode;
}) {
  const url = await navigation();
  const link = (view: string, course = courseId) => {
    const u = new URL(url("merlin"));
    u.searchParams.set("view", view);
    if (course) u.searchParams.set("course", course);
    return u.toString();
  };
  const entries = [
    ["Moji kolegiji", "Pregled kolegija", LayoutDashboard],
    ["Materijali", "Materijali", FileText],
    ["Zadaci", "Zadaci", ClipboardList],
    ["Kvizovi", "Kvizovi", CircleHelp],
    ["Predaje", "Predaje i komentari", GraduationCap],
    ["Bodovi", "Bodovi", BarChart3],
    ["Rokovi", "Rokovi aktivnosti", CalendarDays],
  ] as const;
  const nav = (
    <>
      <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">
        Radni prostor
      </p>
      <a
        href={link("Moji kolegiji", "")}
        className={`mb-6 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${!courseId ? "bg-orange-50 text-orange-800 dark:bg-slate-700 dark:text-orange-200" : "text-slate-500 hover:bg-slate-50"}`}
      >
        <BookOpen size={18} />
        Moji kolegiji
      </a>
      {courseId && (
        <>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">
            U kolegiju
          </p>
          {entries.map(([view, title, Icon]) => (
            <a
              key={view}
              href={link(view)}
              aria-current={view === active ? "page" : undefined}
              className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${active === view ? "bg-orange-50 font-bold text-orange-800 dark:bg-slate-700 dark:text-orange-200" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <Icon size={18} />
              {title}
            </a>
          ))}
        </>
      )}
      <a
        href={url("portal")}
        className="mt-8 flex items-center gap-3 border-t border-slate-200 px-3 pt-6 text-sm text-slate-500"
      >
        <ArrowLeft size={16} />
        Povratak u ISVU
      </a>
    </>
  );
  return (
    <div className="learning-surface min-h-screen bg-[#f3f5f9] dark:bg-slate-950">
      <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 lg:px-8">
        <a href={link("Moji kolegiji", "")} className="flex items-center gap-3">
          <span className="rounded-xl bg-orange-500 p-2.5 text-white">
            <GraduationCap size={26} />
          </span>
          <span className="text-2xl font-bold tracking-tight">
            Merlin
            <span className="ml-3 hidden text-xs font-normal tracking-wide text-slate-400 sm:inline">
              ISVU E-UČENJE
            </span>
          </span>
        </a>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <a
            href={url("auth")}
            aria-label={`Moj račun: ${name || "Korisnik"}`}
            className="flex items-center gap-3 rounded-full border border-slate-200 py-1.5 pl-1.5 pr-4"
          >
            <span className="rounded-full bg-slate-100 p-2 text-slate-600">
              <UserRound size={18} />
            </span>
            <span className="hidden max-w-36 truncate text-sm font-semibold sm:inline">
              {name || "Moj račun"}
            </span>
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-[1680px] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-80px)] border-r border-slate-200 bg-white p-5 lg:block">
          <nav aria-label="Merlin navigacija">{nav}</nav>
          <p className="mt-12 px-3 text-xs leading-5 text-slate-400">
            Vaši kolegiji, znanje i napredak.
            <br />
            Jedan ISVU račun.
          </p>
        </aside>
        <div className="min-w-0">
          <details className="mx-5 mt-5 rounded-xl border border-slate-200 bg-white p-4 lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <Menu size={18} />
              Izbornik e-učenja
            </summary>
            <nav aria-label="Mobilna Merlin navigacija" className="pt-5">
              {nav}
            </nav>
          </details>
          <main className="p-5 md:p-8 xl:p-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
