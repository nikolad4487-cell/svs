import type { AcademicData } from "@/lib/academic/data";
import { annualFields } from "@/lib/academic/registrar";
import { Section, Table } from "./shared";
export function StudentDossier({
  data,
  annual = false,
}: {
  data: AcademicData;
  annual?: boolean;
}) {
  const own = data.account.user.id,
    record = data.studentRecords.find((r) => r.student_id === own);
  if (!data.registrarReady)
    return (
      <p>
        Službene evidencije referade još nisu dostupne. Obratite se referadi.
      </p>
    );
  if (annual)
    return (
      <Section title="Službeni godišnji podaci">
        <p className="text-sm text-slate-500">
          Ove podatke vodi referada. Za ispravak prebivališta, adrese ili
          potvrde obratite se svojoj ustanovi.
        </p>
        {data.studentYearRecords
          .filter((r) => r.student_id === own)
          .map((r) => (
            <details
              key={r.id}
              open
              className="rounded-lg border border-slate-200 p-5"
            >
              <summary className="font-semibold">
                {data.years.find((y) => y.id === r.academic_year_id)?.name}
              </summary>
              <Table
                headings={["Podatak", "Službena evidencija"]}
                rows={annualFields.map(([name, label]) => [
                  label,
                  r.details[name] || "Nije evidentirano",
                ])}
              />
            </details>
          ))}
      </Section>
    );
  return (
    <Section title="Matični podaci studenta">
      <p className="text-sm text-slate-500">
        Službenu evidenciju vodi referada. Lokalni broj razlikuje se od upisnog
        broja kandidata i službenog JMBAG-a.
      </p>
      {record ? (
        <Table
          headings={["Podatak", "Vrijednost"]}
          rows={[
            ["Službeno ime i prezime", record.legal_name],
            ["Lokalni broj", record.local_number],
            ["JMBAG", record.jmbag || "Nije evidentiran"],
            ["OIB", record.oib || "Nije evidentiran"],
            ["Datum rođenja", record.birth_date || "Nije evidentiran"],
            ["Državljanstvo", record.citizenship || "Nije evidentirano"],
          ]}
        />
      ) : (
        <p>Referada još nije evidentirala matične podatke.</p>
      )}
    </Section>
  );
}
