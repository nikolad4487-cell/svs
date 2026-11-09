import "server-only";
import { requireIdentity } from "../auth/access";
import { notFound } from "next/navigation";
import type { StudentService, StudentReport } from "./student-services";
import type * as M from "./model";
import type {
  EnrollmentCase,
  StudentRecord,
  StudentYearRecord,
} from "./registrar";
import type { ExamState } from "./exam-workflow";
import type { CompletionState } from "./enrollment-completion";
export async function academicData(
  institutionId?: string,
  options: { faculty?: string; staffOnly?: boolean } = {},
) {
  const account = await requireIdentity();
  const institutions = await account.db
    .from("institutions")
    .select("*")
    .order("name");
  if (institutions.error) throw new Error("Ustanove nisu dostupne.");
  const available = (institutions.data as M.Institution[]).filter(
    (i) =>
      !options.staffOnly ||
      account.superadmin ||
      account.memberships.some(
        (m) =>
          m.institution_id === i.id &&
          ["institution_admin", "registrar"].includes(m.role),
      ),
  );
  const institution = options.faculty
    ? available.find((i) => i.url_slug === options.faculty)
    : institutionId
      ? available.find((i) => i.id === institutionId)
      : available[0];
  if ((institutionId || options.faculty) && !institution) notFound();
  if (options.faculty && institutionId && institution?.id !== institutionId)
    notFound();
  if (!institution) return null;
  const id = institution.id;
  const table = async <T>(name: string) => {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = account.db.from(name).select("*").eq("institution_id", id);
      query =
        name === "memberships"
          ? query.order("user_id").order("role")
          : query.order("id");
      const result = await query.range(offset, offset + 499);
      if (result.error)
        throw new Error(
          "Studijski podaci nisu dostupni. Primijenite akademsku migraciju.",
        );
      rows.push(...(result.data as T[]));
      if (result.data.length < 500) break;
    }
    return rows;
  };
  const [
    programs,
    years,
    semesters,
    courses,
    studies,
    enrollments,
    teachers,
    groups,
    groupMembers,
    rooms,
    schedule,
    exams,
    registrations,
    grades,
    announcements,
    members,
  ] = await Promise.all([
    table<M.Program>("study_programs"),
    table<M.Year>("academic_years"),
    table<M.Semester>("semesters"),
    table<M.Course>("courses"),
    table<M.Study>("student_studies"),
    table<M.Enrollment>("course_enrollments"),
    table<M.Teacher>("course_teachers"),
    table<M.Group>("teaching_groups"),
    table<M.GroupMember>("group_members"),
    table<M.Room>("rooms"),
    table<M.Schedule>("schedule_entries"),
    table<M.Exam>("exams"),
    table<M.Registration>("exam_registrations"),
    table<M.Grade>("grades"),
    table<M.Announcement>("announcements"),
    table<{ institution_id: string; user_id: string; role: string }>(
      "memberships",
    ),
  ]);
  const ids = [
    ...new Set([
      account.user.id,
      ...members.map((m) => m.user_id),
      ...studies.map((s) => s.student_id),
      ...teachers.map((t) => t.teacher_id),
    ]),
  ];
  const profiles: { id: string; full_name: string }[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const profile = await account.db
      .from("profiles")
      .select("id,full_name")
      .in("id", ids.slice(offset, offset + 200));
    if (profile.error) throw new Error("Imena korisnika nisu dostupna.");
    profiles.push(...profile.data);
  }
  const optionalTable = async <T>(name: string) => {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await account.db
        .from(name)
        .select("*")
        .eq("institution_id", id)
        .order("id")
        .range(offset, offset + 499);
      if (result.error) return { data: null, error: result.error };
      rows.push(...(result.data as T[]));
      if (result.data.length < 500) return { data: rows, error: null };
    }
  };
  const [serviceRows, reportRows] = await Promise.all([
    optionalTable<StudentService>("student_services"),
    optionalTable<StudentReport>("student_reports"),
  ]);
  const servicesReady = !serviceRows.error && !reportRows.error;
  if (
    [serviceRows.error, reportRows.error].some(
      (e) => e && !["PGRST205", "42P01"].includes(e.code),
    )
  )
    throw new Error("Studentske evidencije nisu dostupne.");
  const manager =
    account.superadmin ||
    account.memberships.some(
      (m) =>
        m.institution_id === id &&
        ["institution_admin", "registrar"].includes(m.role),
    );
  const isTeacher = account.memberships.some(
    (m) => m.institution_id === id && m.role === "teacher",
  );
  const workflow = await optionalTable<{
    id: string;
    exam_id: string;
    actor_id: string;
    previous_status: ExamState;
    next_status: ExamState;
    reason: string;
    occurred_at: string;
  }>("exam_workflow_events");
  if (workflow.error && !["PGRST205", "42P01"].includes(workflow.error.code))
    throw new Error("Povijest ispitnih rokova nije dostupna.");
  const completion = await optionalTable<{
    id: string;
    study_id: string;
    actor_id: string;
    previous_status: CompletionState;
    next_status: CompletionState;
    reason: string;
    occurred_at: string;
  }>("enrollment_completion_events");
  if (
    completion.error &&
    !["PGRST205", "42P01"].includes(completion.error.code)
  )
    throw new Error("Povijest provjera upisa nije dostupna.");
  const history = await optionalTable<{
    id: string;
    exam_id: string;
    student_id: string;
    actor_id: string;
    action: string;
    previous_grade: number | null;
    next_grade: number | null;
    previous_outcome: string | null;
    next_outcome: string | null;
    occurred_at: string;
  }>("exam_grade_events");
  if (history.error && !["PGRST205", "42P01"].includes(history.error.code))
    throw new Error("Povijest rezultata nije dostupna.");
  const [caseRows, recordRows, yearRows, caseEventRows] = await Promise.all([
    optionalTable<EnrollmentCase>("registrar_enrollment_cases"),
    optionalTable<StudentRecord>("student_records"),
    optionalTable<StudentYearRecord>("student_year_records"),
    optionalTable<{
      id: string;
      case_id: string;
      action: string;
      reason: string;
      actor_id: string;
      occurred_at: string;
    }>("registrar_case_events"),
  ]);
  if (
    [
      caseRows.error,
      recordRows.error,
      yearRows.error,
      caseEventRows.error,
    ].some((e) => e && !["PGRST205", "42P01"].includes(e.code))
  )
    throw new Error("Evidencije referade nisu dostupne.");
  const studentInvites = await optionalTable<{
    id: string;
    email: string;
    role: string;
    accepted_at: string | null;
    expires_at: string;
    credentials_issued_at: string | null;
  }>("registration_invites");
  if (studentInvites.error) throw new Error("Studentski pozivi nisu dostupni.");
  const studentRoster = manager
    ? await account.db.rpc("registrar_student_roster", { inst: id })
    : { data: [], error: null };
  if (
    studentRoster.error &&
    !["PGRST202", "42883"].includes(studentRoster.error.code)
  )
    throw new Error("Studentski popis nije dostupan.");
  return {
    studentRoster: (studentRoster.data || []) as {
      id: string;
      full_name: string;
      email: string;
    }[],
    studentInvites: (studentInvites.data || []).filter(
      (v) =>
        v.role === "student" &&
        !v.accepted_at &&
        Date.parse(v.expires_at) > Date.now(),
    ),
    registrarReady:
      !studentRoster.error &&
      !caseRows.error &&
      !recordRows.error &&
      !yearRows.error &&
      !caseEventRows.error,
    enrollmentCases: caseRows.data || [],
    studentRecords: recordRows.data || [],
    studentYearRecords: yearRows.data || [],
    registrarEvents: caseEventRows.data || [],
    gradeHistoryReady: !history.error,
    gradeEvents: history.data || [],
    enrollmentCompletionReady: !completion.error,
    enrollmentEvents: completion.data || [],
    examWorkflowReady: !workflow.error,
    examEvents: workflow.data || [],
    account,
    servicesReady,
    services: (serviceRows.data || []) as StudentService[],
    reports: (reportRows.data || []) as StudentReport[],
    institution,
    institutions: available,
    manager,
    isTeacher,
    programs,
    years,
    semesters,
    courses,
    studies,
    enrollments,
    teachers,
    groups,
    groupMembers,
    rooms,
    schedule,
    exams,
    registrations,
    grades,
    announcements,
    members,
    profiles,
  };
}
export type AcademicData = NonNullable<
  Awaited<ReturnType<typeof academicData>>
>;
