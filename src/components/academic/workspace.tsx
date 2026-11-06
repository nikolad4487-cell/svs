import { academicData } from "@/lib/academic/data";
import { navigation } from "@/lib/context";
import type { ModuleSlug } from "@/lib/modules";
import type { AcademicAction } from "@/lib/academic/validation";
import { InstitutionPicker, Empty } from "./shared";
import { Portal } from "./portal";
import { Studomat } from "./studomat";
import { Timetable } from "./schedule";
import { StudentServicesAdmin } from "./student-services";
import { AcademicAdmin } from "./admin";
import { ExamWorkflow } from "./exam-workflow";
import { workflowErrors } from "@/lib/academic/exam-workflow";
import { EnrollmentCompletion } from "./enrollment-completion";
export async function AcademicWorkspace({
  module,
  view,
  status,
  institution,
  date,
  courseId,
  academicYear,
}: {
  module: ModuleSlug;
  view: string;
  status?: string;
  institution?: string;
  date?: string;
  courseId?: string;
  academicYear?: string;
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
    "Upravljanje terminima": ["schedule"],
  };
  return (
    <div>
      <InstitutionPicker data={data} base={url(module)} view={view} />
      {(module === "admin" || module === "isvu") && data.manager && (
        <p className="mb-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          Upravljate podacima ustanove: <strong>{data.institution.name}</strong>
          . Za prvi kolegij najprije dodajte studijski program, akademsku godinu
          i semestar.
        </p>
      )}
      {status && status !== "saved" && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {workflowErrors[status] || (
            <>
              Promjena nije spremljena. Provjerite unesene vrijednosti,
              studenta, povezanost programa, akademske godine i kolegija, rokove
              prijave, kapacitet te moguće preklapanje termina.
            </>
          )}
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
        <Studomat
          data={data}
          view={view}
          courseId={courseId}
          academicYear={academicYear}
        />
      ) : module === "raspored" ? (
        <Timetable data={data} view={view} base={url(module)} date={date} />
      ) : view === "Studentske evidencije" ? (
        <StudentServicesAdmin data={data} module={module} />
      ) : (
        <div className="space-y-10">
          <AcademicAdmin
            data={data}
            module={module}
            view={view}
            actions={sections[view] || ["program"]}
          />
          {view === "Ispitni rokovi" && (data.manager || data.isTeacher) && (
            <ExamWorkflow data={data} module={module} view={view} />
          )}
          {view === "Studenti i upisi" && data.manager && (
            <EnrollmentCompletion data={data} module={module} view={view} />
          )}
        </div>
      )}
    </div>
  );
}
