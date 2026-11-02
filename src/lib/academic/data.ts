import "server-only";
import { requireIdentity } from "../auth/access";
import { notFound } from "next/navigation";
import type { StudentService, StudentReport } from "./student-services";
import type * as M from "./model";
export async function academicData(institutionId?: string) {
  const account = await requireIdentity();
  const institutions = await account.db
    .from("institutions")
    .select("*")
    .order("name");
  if (institutions.error) throw new Error("Ustanove nisu dostupne.");
  const available = institutions.data as M.Institution[];
  const institution = institutionId
    ? available.find((i) => i.id === institutionId)
    : available[0];
  if (institutionId && !institution) notFound();
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
  return {
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
