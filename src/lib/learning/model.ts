export type LearningCourse = {
  id: string;
  institution_id: string;
  institution_name: string;
  name: string;
  code: string;
  semester_name: string;
  academic_year_name: string;
  can_manage: boolean;
  can_submit: boolean;
};
export type Material = {
  id: string;
  course_id: string;
  title: string;
  body: string;
  resource_url: string;
  published: boolean;
  revision: number;
  updated_at: string;
};
export type Assignment = {
  id: string;
  course_id: string;
  title: string;
  instructions: string;
  due_at: string | null;
  max_points: number;
  published: boolean;
  allow_late: boolean;
  revision: number;
};
export type Submission = {
  id: string;
  course_id: string;
  assignment_id: string;
  student_id: string;
  body: string;
  resource_url: string;
  revision: number;
  submitted_at: string;
  score: number | null;
  feedback: string;
  graded_at: string | null;
};
