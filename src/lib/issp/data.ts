import "server-only";
import { requireIdentity } from "../auth/access";
import { academicData } from "../academic/data";
import { notFound } from "next/navigation";
import { zagrebDay } from "./model";
import type {
  Account,
  IsspProfile,
  IsspRecord,
  Transaction,
  Preferences,
} from "./model";
export async function isspData(
  institutionId?: string,
  studentId?: string,
  yearId?: string,
) {
  const identity = await requireIdentity("issp");
  const institutions = await identity.db
    .from("institutions")
    .select("id,name")
    .order("name");
  if (institutions.error) throw new Error("Ustanove nisu dostupne.");
  const available = institutions.data.filter(
    (i) =>
      identity.superadmin ||
      identity.memberships.some(
        (m) =>
          m.institution_id === i.id &&
          ["student", "registrar", "institution_admin"].includes(m.role),
      ),
  );
  const institution = institutionId
    ? available.find((i) => i.id === institutionId)
    : available[0];
  if (institutionId && !institution) notFound();
  if (!institution) return null;
  const data = await academicData(institution.id);
  if (!data) return null;
  const manager = data.manager;
  const student = manager ? studentId : identity.user.id;
  if (!manager && studentId && studentId !== identity.user.id) notFound();
  const roster = manager ? data.studentRoster : [];
  if (student && manager && !roster.some((s) => s.id === student)) notFound();
  if (student && !data.studies.some((s) => s.student_id === student))
    return {
      data,
      available,
      manager,
      student,
      roster,
      needsEnrollment: true,
      ready: false,
      accounts: [] as Account[],
      records: [] as IsspRecord[],
      transactions: [] as Transaction[],
      profile: null as IsspProfile | null,
      preferences: null as Preferences | null,
      year: undefined,
      account: undefined,
    };
  const years = data.years
    .filter(
      (y) =>
        !student ||
        data.studies.some(
          (s) => s.student_id === student && s.academic_year_id === y.id,
        ),
    )
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  const today = zagrebDay();
  const year =
    (yearId ? years.find((y) => y.id === yearId) : undefined) ||
    years.find((y) => y.starts_on <= today && y.ends_on >= today) ||
    years[0];
  if (yearId && !years.some((y) => y.id === yearId)) notFound();
  const table = async <T>(name: string) => {
    const rows: T[] = [];
    if (!student) return { ready: true, rows };
    for (let offset = 0; ; offset += 500) {
      const r = await identity.db
        .from(name)
        .select("*")
        .eq("institution_id", institution.id)
        .eq("student_id", student)
        .order("id")
        .range(offset, offset + 499);
      if (r.error) {
        if (["PGRST205", "42P01"].includes(r.error.code))
          return { ready: false, rows: [] as T[] };
        throw new Error("ISSP evidencije nisu dostupne.");
      }
      rows.push(...r.data);
      if (r.data.length < 500) return { ready: true, rows };
    }
  };
  const [accounts, records, transactions, profiles, preferences] =
    await Promise.all([
      table<Account>("issp_accounts"),
      table<IsspRecord>("issp_records"),
      table<Transaction>("issp_transactions"),
      table<IsspProfile>("issp_profiles"),
      table<Preferences>("issp_preferences"),
    ]);
  return {
    data,
    available,
    manager,
    student,
    roster,
    needsEnrollment: false,
    ready: [accounts, records, transactions, profiles, preferences].every(
      (r) => r.ready,
    ),
    accounts: accounts.rows,
    records: records.rows,
    transactions: transactions.rows,
    profile: profiles.rows[0] || null,
    preferences: preferences.rows[0] || null,
    year,
    account: accounts.rows.find((a) => a.academic_year_id === year?.id),
  };
}
export type IsspData = NonNullable<Awaited<ReturnType<typeof isspData>>>;
