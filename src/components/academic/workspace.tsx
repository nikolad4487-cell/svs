import { academicData } from "@/lib/academic/data";
import { navigation } from "@/lib/context";
import type { ModuleSlug } from "@/lib/modules";
import type { AcademicAction } from "@/lib/academic/validation";
import { InstitutionPicker, Empty } from "./shared";
import { Portal } from "./portal";
import { Studomat } from "./studomat";
import { Timetable } from "./schedule";
import { AcademicAdmin } from "./admin";
export async function AcademicWorkspace({
  module,
  view,
  status,
  institution,
  date,
}: {
  module: ModuleSlug;
  view: string;
  status?: string;
  institution?: string;
  date?: string;
}) {
  const data = await academicData(institution);
  if (!data)
    return (
      <Empty>
        Nemate aktivno članstvo u ustanovi. Obratite se administratoru.
      </Empty>
    );
  const url = await navigation();
  const sections: Record<string, AcademicAction[]> = {
    Pregled: ["program"],
    "Studijski programi": ["program"],
    "Akademske godine": ["year", "semester"],
    Kolegiji: ["course", "teacher", "group"],
    "Studenti i upisi": ["study", "enrollment", "group-member"],
    Dvorane: ["room"],
    "Ispitni rokovi": ["exam"],
    Obavijesti: ["announcement"],
  };
  return (
    <div>
      <InstitutionPicker data={data} base={url(module)} view={view} />
      {status && status !== "saved" && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Promjena nije spremljena. Provjerite povezanost programa, akademske
          godine i kolegija, rokove prijave, kapacitet te moguće preklapanje
          termina.
        </p>
      )}
      {status === "saved" && (
        <p
          role="status"
          className="mb-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-900"
        >
          Promjena je spremljena.
        </p>
      )}
      {module === "portal" ? (
        <Portal data={data} view={view} status={status} />
      ) : module === "studomat" ? (
        <Studomat data={data} view={view} />
      ) : module === "raspored" ? (
        <Timetable data={data} view={view} base={url(module)} date={date} />
      ) : (
        <AcademicAdmin
          data={data}
          module="isvu"
          view={view}
          actions={sections[view] || ["program"]}
        />
      )}
    </div>
  );
}
