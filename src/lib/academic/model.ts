export type Institution = {
  email_domains?: string[];
  id: string;
  name: string;
  code: string;
  registrar_contact?: string;
  student_instructions?: string;
  identity_portal_url?: string;
};
export type Program = {
  id: string;
  institution_id: string;
  name: string;
  code: string;
  degree: string;
  duration_years: number;
};
export type Year = {
  id: string;
  institution_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
};
export type Semester = {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
};
export type Course = {
  id: string;
  institution_id: string;
  program_id: string;
  semester_id: string;
  name: string;
  code: string;
  ects: number;
  lecture_hours?: number;
  exercise_hours?: number;
  elective_group?: string;
  teaching_plan?: string;
};
export type Study = {
  completion_status?: import("./enrollment-completion").CompletionState;
  identity_verified?: boolean;
  documents_verified?: boolean;
  curriculum_verified?: boolean;
  financing_verified?: boolean;
  completion_revision?: number;
  completed_at?: string | null;
  completed_by?: string | null;
  id: string;
  institution_id: string;
  student_id: string;
  program_id: string;
  academic_year_id: string;
  study_year: number;
  student_number: string;
  status: string;
};
export type Enrollment = {
  id: string;
  institution_id: string;
  study_id: string;
  course_id: string;
  student_id: string;
  enrolled_at: string;
};
export type Teacher = {
  id: string;
  institution_id: string;
  course_id: string;
  teacher_id: string;
};
export type Group = {
  id: string;
  institution_id: string;
  course_id: string;
  name: string;
};
export type GroupMember = {
  id: string;
  institution_id: string;
  course_id: string;
  group_id: string;
  student_id: string;
};
export type Room = {
  id: string;
  institution_id: string;
  name: string;
  capacity: number;
};
export type Schedule = {
  id: string;
  institution_id: string;
  course_id: string;
  teacher_id: string;
  room_id: string;
  group_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
};
export type Exam = {
  workflow_status?: import("./exam-workflow").ExamState;
  legacy_workflow?: boolean;
  id: string;
  institution_id: string;
  course_id: string;
  room_id: string;
  starts_at: string;
  registration_deadline: string;
  withdrawal_deadline: string;
  capacity: number;
};
export type Registration = {
  id: string;
  institution_id: string;
  exam_id: string;
  student_id: string;
  status: string;
  registered_at: string;
};
export type Grade = {
  id: string;
  institution_id: string;
  exam_id: string;
  student_id: string;
  grade: number | null;
  outcome?: "graded" | "absent";
  feedback: string;
  graded_by: string;
  graded_at: string;
};
export type Announcement = {
  id: string;
  institution_id: string;
  course_id: string | null;
  title: string;
  body: string;
  author_id: string;
  published_at: string;
};
