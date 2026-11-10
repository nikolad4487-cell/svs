import { GraduationCap, UserRound, ArrowLeft } from "lucide-react";
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
  const dashboard = new URL(url("merlin"));
  dashboard.searchParams.set("view", "Moji kolegiji");
  return (
    <div className="learning-surface min-h-screen bg-[#f7f8fa] dark:bg-slate-950">
      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-7">
        <div className="flex flex-wrap items-center gap-4 lg:gap-7">
          <a
            href={dashboard.toString()}
            className="flex items-center gap-2 text-2xl font-semibold tracking-tight"
          >
            <GraduationCap className="text-blue-700" size={28} />
            Merlin
          </a>
          <nav
            aria-label="Merlin navigacija"
            className="flex items-center gap-2 text-sm"
          >
            <a
              href={dashboard.toString()}
              aria-current={!courseId ? "page" : undefined}
              className={`rounded-lg px-3 py-2 ${!courseId ? "bg-slate-100 font-semibold" : "text-slate-500"}`}
            >
              Moji kolegiji
            </a>
            <a
              href={url("portal")}
              className="hidden items-center gap-1 px-2 text-slate-500 sm:flex"
            >
              <ArrowLeft size={14} />
              ISVU
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href={url("auth")}
            aria-label={`Moj račun: ${name || "Korisnik"}`}
            className="flex items-center gap-2 text-sm"
          >
            <span className="rounded-full bg-slate-100 p-2 text-slate-600">
              <UserRound size={18} />
            </span>
            <span className="hidden max-w-40 truncate sm:inline">
              {name || "Moj račun"}
            </span>
          </a>
        </div>
      </header>
      <main
        className={`mx-auto min-w-0 px-4 py-7 md:px-8 md:py-10 ${courseId ? "max-w-[1440px]" : "max-w-[1080px]"}`}
        data-learning-view={active}
      >
        {children}
      </main>
    </div>
  );
}
