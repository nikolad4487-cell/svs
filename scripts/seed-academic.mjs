import { localConfig } from "./local-config.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
const env = localConfig();
if (!["localhost", "127.0.0.1"].includes(new URL(env.API_URL).hostname))
  throw new Error("Local test data only");
const users = JSON.parse(readFileSync(".local-test-users.json", "utf8"));
const db = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
async function upsert(table, rows) {
  const r = await db.from(table).upsert(rows);
  if (r.error) throw new Error(`${table}: ${r.error.message}`);
}
await upsert("study_programs", [
  {
    id: id(1),
    institution_id: a,
    name: "Računarstvo",
    code: "RAC",
    degree: "Prijediplomski",
    duration_years: 3,
  },
  {
    id: id(2),
    institution_id: b,
    name: "Poslovna informatika",
    code: "PI",
    degree: "Stručni",
    duration_years: 3,
  },
]);
await upsert(
  "academic_years",
  [a, b].map((institution_id, i) => ({
    id: id(11 + i),
    institution_id,
    name: "2026./2027.",
    starts_on: "2026-10-01",
    ends_on: "2027-09-30",
  })),
);
await upsert(
  "semesters",
  [a, b].map((institution_id, i) => ({
    id: id(21 + i),
    institution_id,
    academic_year_id: id(11 + i),
    name: "Zimski semestar",
    starts_on: "2026-10-01",
    ends_on: "2027-02-28",
  })),
);
await upsert("courses", [
  {
    id: id(31),
    institution_id: a,
    program_id: id(1),
    semester_id: id(21),
    name: "Uvod u programiranje",
    code: "RAC101",
    ects: 6,
  },
  {
    id: id(32),
    institution_id: b,
    program_id: id(2),
    semester_id: id(22),
    name: "Osnove poslovanja",
    code: "PI101",
    ects: 5,
  },
]);
await upsert("student_studies", [
  {
    id: id(51),
    institution_id: a,
    student_id: users.student.id,
    program_id: id(1),
    academic_year_id: id(11),
    study_year: 1,
    student_number: "TEST000001",
    status: "active",
  },
  {
    id: id(52),
    institution_id: b,
    student_id: users.student2.id,
    program_id: id(2),
    academic_year_id: id(12),
    study_year: 1,
    student_number: "TEST000002",
    status: "active",
  },
]);
await upsert("course_enrollments", [
  {
    id: id(81),
    institution_id: a,
    study_id: id(51),
    course_id: id(31),
    student_id: users.student.id,
  },
  {
    id: id(82),
    institution_id: b,
    study_id: id(52),
    course_id: id(32),
    student_id: users.student2.id,
  },
]);
await upsert("course_teachers", [
  {
    id: id(61),
    institution_id: a,
    course_id: id(31),
    teacher_id: users.nastavnik.id,
  },
]);
await upsert("rooms", [
  { id: id(41), institution_id: a, name: "Predavaonica A1", capacity: 50 },
  { id: id(42), institution_id: b, name: "Predavaonica B1", capacity: 30 },
]);
await upsert("teaching_groups", [
  { id: id(91), institution_id: a, course_id: id(31), name: "Grupa A" },
]);
await upsert("group_members", [
  {
    id: id(92),
    institution_id: a,
    course_id: id(31),
    group_id: id(91),
    student_id: users.student.id,
  },
]);
const now = Date.now(),
  after = (days, hour = 10) => {
    const d = new Date(now + days * 86400000);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
await upsert("exams", [
  {
    id: id(71),
    institution_id: a,
    course_id: id(31),
    room_id: id(41),
    starts_at: after(10),
    registration_deadline: after(8),
    withdrawal_deadline: after(9),
    capacity: 20,
  },
  {
    id: id(72),
    institution_id: b,
    course_id: id(32),
    room_id: id(42),
    starts_at: after(11),
    registration_deadline: after(8),
    withdrawal_deadline: after(9),
    capacity: 20,
  },
  {
    id: id(73),
    institution_id: a,
    course_id: id(31),
    room_id: id(41),
    starts_at: after(-2),
    registration_deadline: after(-4),
    withdrawal_deadline: after(-3),
    capacity: 20,
  },
]);
await upsert("exam_registrations", [
  {
    id: id(83),
    institution_id: a,
    exam_id: id(73),
    student_id: users.student.id,
    status: "registered",
  },
]);
await upsert("schedule_entries", [
  {
    id: id(101),
    institution_id: a,
    course_id: id(31),
    teacher_id: users.nastavnik.id,
    room_id: id(41),
    group_id: id(91),
    title: "Predavanje: uvod u algoritme",
    starts_at: after(1, 9),
    ends_at: after(1, 11),
  },
]);
await upsert("announcements", [
  {
    id: id(111),
    institution_id: a,
    course_id: null,
    title: "Dobro došli u novu akademsku godinu",
    body: "Ovo su označeni testni podaci lokalne razvojne baze. Pregledajte raspored i upisane kolegije.",
    author_id: users.admin.id,
  },
]);
writeFileSync(
  ".local-academic.json",
  JSON.stringify({
    a,
    b,
    programA: id(1),
    programB: id(2),
    yearA: id(11),
    yearB: id(12),
    semesterA: id(21),
    semesterB: id(22),
    courseA: id(31),
    courseB: id(32),
    roomA: id(41),
    roomB: id(42),
    studyA: id(51),
    studyB: id(52),
    examA: id(71),
    examB: id(72),
    pastExam: id(73),
    schedule: id(101),
    group: id(91),
  }),
  { mode: 0o600 },
);
console.log(
  "Local academic fixtures ready: programs, years, semesters, enrolments, exams, group and timetable.",
);
