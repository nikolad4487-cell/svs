"use client";
import { useState } from "react";
import { inputClass, Submit } from "@/components/auth/forms";
import { enrollmentKinds, type EnrollmentCase } from "@/lib/academic/registrar";
import type { Program, Year, Study } from "@/lib/academic/model";
export function RegistrarCaseForm({
  institution,
  students,
  programs,
  years,
  studies,
  record,
}: {
  institution: string;
  students: { id: string; name: string }[];
  programs: Program[];
  years: Year[];
  studies: Study[];
  record?: EnrollmentCase;
}) {
  const [student, setStudent] = useState(
    record?.student_id || students[0]?.id || "",
  );
  const [program, setProgram] = useState(
    record?.program_id || programs[0]?.id || "",
  );
  const [kind, setKind] = useState(record?.kind || "first_matura");
  return (
    <form
      method="post"
      action="/api/registrar/case"
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="institution_id" value={institution} />
      <input type="hidden" name="return_view" value="Upisni postupci" />
      <input
        type="hidden"
        name="expected_revision"
        value={record?.revision || 0}
      />
      {record && <input type="hidden" name="id" value={record.id} />}
      <label className="text-sm">
        Student
        <select
          name="student_id"
          value={student}
          onChange={(e) => setStudent(e.target.value)}
          required
          className={inputClass}
          disabled={!!record}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {record && <input type="hidden" name="student_id" value={student} />}
      </label>
      <label className="text-sm">
        Vrsta upisa
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className={inputClass}
        >
          {Object.entries(enrollmentKinds).map(([k, n]) => (
            <option key={k} value={k}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Studijski program
        <select
          name="program_id"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          required
          className={inputClass}
          disabled={!!record}
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.degree}
            </option>
          ))}
        </select>
        {record && <input type="hidden" name="program_id" value={program} />}
      </label>
      <label className="text-sm">
        Akademska godina
        <select
          name="academic_year_id"
          defaultValue={record?.academic_year_id || ""}
          required
          className={inputClass}
          disabled={!!record}
        >
          <option value="">Odaberite…</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
        {record && (
          <input
            type="hidden"
            name="academic_year_id"
            value={record.academic_year_id}
          />
        )}
      </label>
      <label className="text-sm">
        Godina studija
        <input
          name="study_year"
          type="number"
          min={1}
          max={programs.find((p) => p.id === program)?.duration_years || 8}
          required
          defaultValue={record?.study_year || 1}
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Način studiranja
        <select
          name="mode"
          defaultValue={record?.mode || "full_time"}
          className={inputClass}
        >
          <option value="full_time">Redoviti</option>
          <option value="part_time">Izvanredni</option>
        </select>
      </label>
      <label className="text-sm">
        Temelj financiranja
        <input
          name="financing"
          required
          minLength={2}
          maxLength={300}
          defaultValue={record?.financing}
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Upisni broj kandidata (različit od JMBAG-a)
        <input
          name="admission_number"
          maxLength={100}
          defaultValue={record?.admission_number}
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Oznaka odluke / dokaza prava upisa
        <input
          name="decision_reference"
          required
          minLength={3}
          maxLength={300}
          defaultValue={record?.decision_reference}
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Izvorno učilište / studij
        <input
          name="source_institution"
          required={kind === "transfer"}
          maxLength={300}
          defaultValue={record?.source_institution}
          className={inputClass}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Prethodni upis studenta (obvezan za višu godinu, ponavljanje i nastavak)
        <select
          name="previous_study_id"
          defaultValue={record?.previous_study_id || ""}
          required={["next_year", "repeat", "continuation"].includes(kind)}
          className={inputClass}
        >
          <option value="">Nije primjenjivo</option>
          {studies
            .filter(
              (s) =>
                s.student_id === student &&
                s.program_id === program &&
                s.completion_status === "completed",
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                {years.find((y) => y.id === s.academic_year_id)?.name} ·{" "}
                {s.study_year}. godina
              </option>
            ))}
        </select>
      </label>
      {[
        ["winter_semester", "Studentov semestar u zimi"],
        ["summer_semester", "Studentov semestar u ljetu"],
      ].map(([name, label]) => (
        <label className="text-sm" key={name}>
          {label}
          <input
            name={name}
            type="number"
            min={1}
            max={16}
            defaultValue={
              record?.[name as "winter_semester" | "summer_semester"] || ""
            }
            className={inputClass}
          />
        </label>
      ))}
      <p className="text-xs text-slate-500 sm:col-span-2">
        Za poslijediplomski studij upišite najmanje jedan semestar. Godina
        studija odgovara nižem od odabranih semestara. Uvjeti i financiranje
        provjeravaju se prema odluci ustanove.
      </p>
      <label className="text-sm sm:col-span-2">
        Obrazloženje postupka
        <textarea
          name="reason"
          required
          minLength={10}
          maxLength={1000}
          className={inputClass}
        />
      </label>
      <div className="sm:col-span-2">
        <Submit>{record ? "Spremi pripremu" : "Otvori upisni postupak"}</Submit>
      </div>
    </form>
  );
}
