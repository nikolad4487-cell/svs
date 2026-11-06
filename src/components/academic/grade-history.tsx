import type { AcademicData } from "@/lib/academic/data";
import { Section, Table, person, courseName } from "./shared";
import { hrDate } from "@/lib/academic/time";
const result = (grade: number | null, outcome: string | null) =>
  outcome === "absent"
    ? "Nije pristupio/la"
    : grade === null
      ? "—"
      : String(grade);
export function GradeHistory({
  data,
  ownOnly = false,
}: {
  data: AcademicData;
  ownOnly?: boolean;
}) {
  if (!data.gradeHistoryReady)
    return (
      <p className="text-sm text-amber-800">
        Za povijest ispravaka rezultata primijenite migraciju
        202611060004_grade_history.sql.
      </p>
    );
  const events = data.gradeEvents.filter(
    (e) => !ownOnly || e.student_id === data.account.user.id,
  );
  return (
    <Section title="Povijest rezultata ispita">
      <p className="text-sm text-slate-500">
        Početno stanje prikazuje zatečeni rezultat prije uvođenja povijesti.
        Naknadni unosi i ispravci čuvaju prethodni ishod.
      </p>
      <Table
        headings={[
          "Ispit",
          "Student",
          "Prethodni ishod",
          "Novi ishod",
          "Vrijeme i evidentirao/la",
        ]}
        rows={[...events]
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
          .map((e) => [
            <span key="exam">
              {courseName(
                data,
                data.exams.find((x) => x.id === e.exam_id)?.course_id || "",
              )}
              <br />
              <small>
                {e.action === "BASELINE"
                  ? "Početno stanje"
                  : e.action === "INSERT"
                    ? "Prvi unos"
                    : e.action === "DELETE"
                      ? "Uklanjanje rezultata"
                      : "Ispravak"}
              </small>
            </span>,
            person(data, e.student_id),
            result(e.previous_grade, e.previous_outcome),
            result(e.next_grade, e.next_outcome),
            <span key="actor">
              {hrDate(e.occurred_at)}
              <br />
              {person(data, e.actor_id)}
            </span>,
          ])}
      />
    </Section>
  );
}
