import { createHash } from 'node:crypto';

export function loginName(first, last, studentId, domain) {
  const part = (s) => s.toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  const base = [part(first), part(last)].filter(Boolean).join('.').slice(0, 40) || 'student';
  const suffix = createHash('sha256').update(studentId).digest('hex').slice(0, 12);
  return `${base}.${suffix}@${domain}`;
}

export function planImport(enrollments, mappings, source) {
  const plans = [], seen = new Set();
  for (const e of enrollments) {
    if (e.status !== 'ACTIVE' || e.schools?.education_level !== 'HIGHER') continue;
    const matches = mappings.filter(m => m.school_id === e.school_id && m.program_id === e.program_id && m.school_year_id === e.school_year_id);
    if (matches.length !== 1) throw new Error('Aktivni upis nema jednoznačno mapiranje fakulteta, programa i godine.');
    const m = matches[0], student = e.registry_students;
    if (!student?.id || !student.first_name?.trim() || !student.last_name?.trim()) throw new Error('Upis nema identitet, ime ili prezime učenika.');
    const key = `${source}:${student.id}:${m.institution_id}`;
    const studyKey = `${key}:${m.svs_program_id}:${m.academic_year_id}`;
    if (seen.has(studyKey)) throw new Error('Izvor sadrži dvostruki aktivni upis za isti studij i godinu.');
    seen.add(studyKey);
    plans.push({ key, student_id: student.id, full_name: `${student.first_name} ${student.last_name}`.trim(),
      email: loginName(student.first_name, student.last_name, student.id, m.domain), mapping: m });
  }
  return plans;
}
