import { z } from "zod";
import { fromZagrebLocal } from "./time";
const uuid = z.uuid();
const name = z.string().trim().min(2).max(200);
const code = z.string().trim().min(2).max(30);
const date = z.iso.date();
const time = z.string().transform((v, ctx) => {
  try {
    return fromZagrebLocal(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "Neispravno hrvatsko vrijeme." });
    return z.NEVER;
  }
});
export const schemas = {
  program: z.object({
    name,
    code,
    degree: z.enum([
      "Prijediplomski",
      "Diplomski",
      "Integrirani",
      "Stručni",
      "Poslijediplomski",
    ]),
    duration_years: z.coerce.number().int().min(1).max(8),
  }),
  year: z
    .object({
      name: z.string().trim().min(4).max(30),
      starts_on: date,
      ends_on: date,
    })
    .refine((v) => v.starts_on < v.ends_on),
  semester: z
    .object({
      academic_year_id: uuid,
      name: z.string().trim().min(2).max(80),
      starts_on: date,
      ends_on: date,
    })
    .refine((v) => v.starts_on < v.ends_on),
  course: z.object({
    program_id: uuid,
    semester_id: uuid,
    name,
    code,
    ects: z.coerce.number().min(0.5).max(30).multipleOf(0.5),
  }),
  study: z.object({
    student_id: uuid,
    program_id: uuid,
    academic_year_id: uuid,
    study_year: z.coerce.number().int().min(1).max(8),
    student_number: code,
    status: z.enum(["active", "completed", "paused"]),
  }),
  enrollment: z.object({ study_id: uuid, course_id: uuid }),
  teacher: z.object({ course_id: uuid, teacher_id: uuid }),
  group: z.object({ course_id: uuid, name: z.string().trim().min(2).max(80) }),
  "group-member": z.object({ group_id: uuid, student_id: uuid }),
  room: z.object({
    name: z.string().trim().min(2).max(100),
    capacity: z.coerce.number().int().min(1).max(10000),
  }),
  exam: z
    .object({
      course_id: uuid,
      room_id: uuid,
      starts_at: time,
      registration_deadline: time,
      withdrawal_deadline: time,
      capacity: z.coerce.number().int().min(1).max(10000),
    })
    .refine(
      (v) =>
        v.registration_deadline <= v.starts_at &&
        v.withdrawal_deadline <= v.starts_at,
    ),
  schedule: z
    .object({
      course_id: uuid,
      teacher_id: uuid,
      room_id: uuid,
      group_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
      title: name,
      starts_at: time,
      ends_at: time,
    })
    .refine((v) => v.starts_at < v.ends_at),
  announcement: z.object({
    course_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
    title: name,
    body: z.string().trim().min(2).max(5000),
  }),
};
export const tables = {
  program: "study_programs",
  year: "academic_years",
  semester: "semesters",
  course: "courses",
  study: "student_studies",
  enrollment: "course_enrollments",
  teacher: "course_teachers",
  group: "teaching_groups",
  "group-member": "group_members",
  room: "rooms",
  exam: "exams",
  schedule: "schedule_entries",
  announcement: "announcements",
} as const;
export type AcademicAction = keyof typeof tables;
