import type { AcademicData } from "@/lib/academic/data";
import type { AcademicAction } from "@/lib/academic/validation";
import type { ModuleSlug } from "@/lib/modules";
import { Submit, inputClass } from "@/components/auth/forms";
import { AcademicHidden, Section, Table, person, courseName } from "./shared";
import { zagrebInput, hrDate } from "@/lib/academic/time";
type Option = { id: string; label: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: Option[];
  optional?: boolean;
  step?: string;
};
type Resource = {
  action: AcademicAction;
  title: string;
  fields: Field[];
  records: Record<string, unknown>[];
};
function resources(data: AcademicData): Resource[] {
  const opts = (values: { id: string; name: string }[]) =>
    values.map((v) => ({ id: v.id, label: v.name }));
  const courses = data.courses
    .filter(
      (c) =>
        data.manager ||
        data.teachers.some(
          (t) => t.course_id === c.id && t.teacher_id === data.account.user.id,
        ),
    )
    .map((c) => ({
      id: c.id,
      label: `${courseName(data, c.id)} (${data.semesters.find((s) => s.id === c.semester_id)?.name || ""})`,
    }));
  const users = (role: string) =>
    data.members
      .filter((m) => m.role === role)
      .map((m) => ({ id: m.user_id, label: person(data, m.user_id) }));
  const program: Field = {
    name: "program_id",
    label: "Studijski program",
    options: opts(data.programs),
  };
  const year: Field = {
    name: "academic_year_id",
    label: "Akademska godina",
    options: opts(data.years),
  };
  const course: Field = {
    name: "course_id",
    label: "Kolegij",
    options: courses,
  };
  const teacher: Field = {
    name: "teacher_id",
    label: "Nastavnik",
    options: data.manager
      ? users("teacher")
      : [
          {
            id: data.account.user.id,
            label: person(data, data.account.user.id),
          },
        ],
  };
  const room: Field = {
    name: "room_id",
    label: "Dvorana",
    options: opts(data.rooms),
  };
  const group: Field = {
    name: "group_id",
    label: "Nastavna grupa",
    options: data.groups.map((g) => ({
      id: g.id,
      label: `${g.name} · ${courseName(data, g.course_id)}`,
    })),
  };
  const dates: Field[] = [
    { name: "starts_on", label: "Početak", type: "date" },
    { name: "ends_on", label: "Završetak", type: "date" },
  ];
  return [
    {
      action: "program",
      title: "Studijski programi",
      fields: [
        { name: "name", label: "Naziv" },
        { name: "code", label: "Šifra" },
        {
          name: "degree",
          label: "Razina",
          options: [
            "Prijediplomski",
            "Diplomski",
            "Integrirani",
            "Stručni",
            "Poslijediplomski",
          ].map((v) => ({ id: v, label: v })),
        },
        { name: "duration_years", label: "Trajanje (godine)", type: "number" },
      ],
      records: data.programs,
    },
    {
      action: "year",
      title: "Akademske godine",
      fields: [{ name: "name", label: "Naziv (npr. 2026./2027.)" }, ...dates],
      records: data.years,
    },
    {
      action: "semester",
      title: "Semestri",
      fields: [year, { name: "name", label: "Naziv semestra" }, ...dates],
      records: data.semesters,
    },
    {
      action: "course",
      title: "Kolegiji",
      fields: [
        program,
        {
          name: "semester_id",
          label: "Semestar",
          options: data.semesters.map((s) => ({
            id: s.id,
            label: `${data.years.find((y) => y.id === s.academic_year_id)?.name} · ${s.name}`,
          })),
        },
        { name: "name", label: "Naziv" },
        { name: "code", label: "Šifra" },
        { name: "ects", label: "ECTS bodovi", type: "number", step: "0.5" },
        {
          name: "lecture_hours",
          label: "Sati predavanja",
          type: "number",
          optional: true,
        },
        {
          name: "exercise_hours",
          label: "Sati vježbi",
          type: "number",
          optional: true,
        },
        { name: "elective_group", label: "Izborna grupa", optional: true },
        {
          name: "teaching_plan",
          label: "Plan nastave",
          type: "textarea",
          optional: true,
        },
      ],
      records: data.courses,
    },
    {
      action: "study",
      title: "Upisi studija",
      fields: [
        { name: "student_id", label: "Student", options: users("student") },
        program,
        year,
        { name: "study_year", label: "Godina studija", type: "number" },
        { name: "student_number", label: "Matični broj / JMBAG" },
        {
          name: "status",
          label: "Status",
          options: [
            { id: "active", label: "Aktivan" },
            { id: "completed", label: "Završen" },
            { id: "paused", label: "Mirovanje" },
          ],
        },
      ],
      records: data.studies,
    },
    {
      action: "enrollment",
      title: "Upisi kolegija",
      fields: [
        {
          name: "study_id",
          label: "Upis studija",
          options: data.studies.map((s) => ({
            id: s.id,
            label: `${person(data, s.student_id)} · ${data.programs.find((p) => p.id === s.program_id)?.name} · ${data.years.find((y) => y.id === s.academic_year_id)?.name}`,
          })),
        },
        course,
      ],
      records: data.enrollments,
    },
    {
      action: "teacher",
      title: "Nastavnici na kolegijima",
      fields: [course, teacher],
      records: data.teachers,
    },
    {
      action: "group",
      title: "Nastavne grupe",
      fields: [course, { name: "name", label: "Naziv grupe" }],
      records: data.groups,
    },
    {
      action: "group-member",
      title: "Članovi nastavnih grupa",
      fields: [
        group,
        {
          name: "student_id",
          label: "Student (mora biti upisan na kolegij)",
          options: users("student"),
        },
      ],
      records: data.groupMembers,
    },
    {
      action: "room",
      title: "Dvorane",
      fields: [
        { name: "name", label: "Naziv dvorane" },
        { name: "capacity", label: "Kapacitet", type: "number" },
      ],
      records: data.rooms,
    },
    {
      action: "exam",
      title: "Ispitni rokovi",
      fields: [
        course,
        room,
        {
          name: "starts_at",
          label: "Početak ispita (hrvatsko vrijeme)",
          type: "datetime-local",
        },
        {
          name: "registration_deadline",
          label: "Prijave do (hrvatsko vrijeme)",
          type: "datetime-local",
        },
        {
          name: "withdrawal_deadline",
          label: "Odjave do (hrvatsko vrijeme)",
          type: "datetime-local",
        },
        { name: "capacity", label: "Broj mjesta", type: "number" },
      ],
      records: data.exams.filter(
        (e) => data.manager || courses.some((c) => c.id === e.course_id),
      ),
    },
    {
      action: "schedule",
      title: "Termini nastave",
      fields: [
        course,
        teacher,
        room,
        { ...group, optional: true },
        { name: "title", label: "Naziv termina" },
        {
          name: "starts_at",
          label: "Početak (hrvatsko vrijeme)",
          type: "datetime-local",
        },
        {
          name: "ends_at",
          label: "Završetak (hrvatsko vrijeme)",
          type: "datetime-local",
        },
      ],
      records: data.schedule.filter(
        (s) => data.manager || s.teacher_id === data.account.user.id,
      ),
    },
    {
      action: "announcement",
      title: "Obavijesti",
      fields: [
        { ...course, optional: data.manager },
        { name: "title", label: "Naslov" },
        { name: "body", label: "Tekst obavijesti", type: "textarea" },
      ],
      records: data.announcements.filter(
        (a) => data.manager || a.author_id === data.account.user.id,
      ),
    },
  ];
}
function RecordForm({
  resource,
  data,
  module,
  view,
  record,
}: {
  resource: Resource;
  data: AcademicData;
  module: ModuleSlug;
  view: string;
  record?: Record<string, unknown>;
}) {
  return (
    <form
      action={`/api/academic/${resource.action}`}
      method="post"
      className="grid gap-4 sm:grid-cols-2"
    >
      <AcademicHidden data={data} module={module} view={view} />
      {record && (
        <input name="id" type="hidden" value={String(record.id)} />
      )}{" "}
      {resource.fields.map((field) => {
        let value = record?.[field.name];
        if (field.type === "datetime-local" && value)
          value = zagrebInput(String(value));
        const props = {
          name: field.name,
          required: !field.optional,
          defaultValue:
            value === null || value === undefined ? "" : String(value),
          className: inputClass,
        };
        return (
          <label
            key={field.name}
            className={`block text-sm font-medium ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
          >
            {field.label}
            {field.options ? (
              <select {...props}>
                <option value="">
                  {field.optional
                    ? "Bez grupe / cijela ustanova"
                    : "Odaberite…"}
                </option>
                {field.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea {...props} rows={4} maxLength={5000} />
            ) : (
              <input
                {...props}
                type={field.type || "text"}
                step={field.step || (field.type === "number" ? "1" : undefined)}
                maxLength={field.type ? undefined : 200}
              />
            )}
          </label>
        );
      })}
      <div className="sm:col-span-2">
        <Submit>{record ? "Spremi promjene" : "Dodaj zapis"}</Submit>
      </div>
    </form>
  );
}
export function AcademicAdmin({
  data,
  module,
  view,
  actions,
}: {
  data: AcademicData;
  module: ModuleSlug;
  view: string;
  actions: AcademicAction[];
}) {
  const allowed = data.manager || data.isTeacher;
  return (
    <div className="space-y-10">
      {!allowed ? (
        <p>Za upravljanje podacima potrebne su dodatne ovlasti.</p>
      ) : (
        resources(data)
          .filter(
            (r) =>
              actions.includes(r.action) &&
              (data.manager ||
                ["exam", "schedule", "announcement"].includes(r.action)),
          )
          .map((resource) => (
            <Section key={resource.action} title={resource.title}>
              <details className="rounded-lg border border-slate-200 p-4">
                <summary className="cursor-pointer font-semibold text-blue-700">
                  Novi zapis · {resource.title.toLowerCase()}
                </summary>
                <div className="mt-5">
                  <RecordForm
                    resource={resource}
                    data={data}
                    module={module}
                    view={view}
                  />
                </div>
              </details>
              <Table
                headings={[
                  ...resource.fields.map((f) => f.label),
                  "Uređivanje",
                ]}
                rows={resource.records.map((record) => [
                  ...resource.fields.map((f) => {
                    const value = record[f.name];
                    if (value === null || value === undefined || value === "")
                      return "—";
                    if (f.options)
                      return (
                        f.options.find((o) => o.id === value)?.label ||
                        String(value)
                      );
                    if (f.type === "datetime-local")
                      return hrDate(String(value));
                    return String(value);
                  }),
                  record.workflow_status === "locked" ? (
                    "Zaključano"
                  ) : (
                    <details key={String(record.id)}>
                      <summary className="cursor-pointer text-blue-700">
                        Uredi
                      </summary>
                      <div className="mt-4 min-w-72">
                        <RecordForm
                          resource={resource}
                          data={data}
                          module={module}
                          view={view}
                          record={record}
                        />
                      </div>
                    </details>
                  ),
                ])}
              />
            </Section>
          ))
      )}
    </div>
  );
}
