import { facultyUrl } from "@/lib/routes";
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
import { RegistrarWorkspace } from "./registrar-workspace";
import { registrarErrors } from "@/lib/academic/registrar";
import { EnrollmentCompletion } from "./enrollment-completion";
export async function AcademicWorkspace({
  module,
  view,
  status,
  institution,
  date,
  courseId,
  academicYear,
  studentId,
  faculty,
}: {
  module: ModuleSlug;
  view: string;
  status?: string;
  institution?: string;
  date?: string;
  courseId?: string;
  academicYear?: string;
  studentId?: string;
  faculty?: string;
}) {
  const data = await academicData(institution, {
    faculty: module === "raspored" ? faculty : undefined,
    staffOnly: module === "referada",
  });
  if (!data)
    return (
      <Empty>
        Nemate aktivno članstvo u ustanovi. Obratite se administratoru.
      </Empty>
    );
  const url = await navigation();
  if (module === "referada" && !institution && data.institutions.length > 1)
    return (
      <div>
        <p className="mb-5">
          Imate ovlasti na više ustanova. Odaberite ustanovu za rad u referadi.
        </p>
        <InstitutionPicker
          data={data}
          base={url(module)}
          view={view}
          requireSelection
        />
      </div>
    );
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
      {["referada", "admin", "isvu", "studomat"].includes(module) && (
        <a
          className="mb-5 inline-block rounded-lg border border-lime-300 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-900"
          href={`${url("issp")}${url("issp").includes("?") ? "&" : "?"}institution=${data.institution.id}`}
        >
          ISSP · prava, iskaznice i osobni računi
        </a>
      )}
      {module === "raspored" && faculty ? (
        <p className="mb-6 rounded-lg bg-blue-50 p-4">
          Raspored ustanove: <strong>{data.institution.name}</strong>
        </p>
      ) : (
        <InstitutionPicker data={data} base={url(module)} view={view} />
      )}
      {module === "raspored" && !faculty && (
        <div className="mb-6 flex flex-wrap gap-3">
          {data.institutions
            .filter((i) => i.url_slug)
            .map((i) => (
              <a
                className="text-sm text-blue-700 underline"
                key={i.id}
                href={facultyUrl(url("raspored"), i.url_slug!)}
              >
                {i.name}
              </a>
            ))}
        </div>
      )}
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
          {workflowErrors[status] || registrarErrors[status] || (
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
      {module === "referada" ? (
        <RegistrarWorkspace data={data} view={view} studentId={studentId} />
      ) : module === "portal" ? (
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
