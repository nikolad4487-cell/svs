import type { AcademicData } from "@/lib/academic/data";
import type { ModuleSlug } from "@/lib/modules";
import { inputClass } from "@/components/auth/forms";
export function AcademicHidden({
  data,
  module,
  view,
}: {
  data: AcademicData;
  module: ModuleSlug;
  view: string;
}) {
  return (
    <>
      <input type="hidden" name="institution_id" value={data.institution.id} />
      <input type="hidden" name="return_module" value={module} />
      <input type="hidden" name="return_view" value={view} />
    </>
  );
}
export function Empty({
  children = "Nema zapisa za odabranu ustanovu.",
}: {
  children?: React.ReactNode;
}) {
  return (
    <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">
      {children}
    </p>
  );
}
export function Table({
  headings,
  rows,
}: {
  headings: string[];
  rows: React.ReactNode[][];
}) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {headings.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-3 py-3 font-semibold text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-200 align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
export function InstitutionPicker({
  data,
  base,
  view,
}: {
  data: AcademicData;
  base: string;
  view: string;
}) {
  const target = new URL(base);
  return (
    <form
      method="get"
      action={target.pathname}
      className="mb-8 flex flex-wrap items-end gap-3"
    >
      {[...target.searchParams].map(([name, value]) => (
        <input key={name} name={name} value={value} type="hidden" />
      ))}
      <input type="hidden" name="view" value={view} />
      <label className="min-w-64 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Ustanova
        <select
          className={inputClass}
          name="institution"
          defaultValue={data.institution.id}
        >
          {data.institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <button className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold">
        Prikaži
      </button>
    </form>
  );
}
export function person(data: AcademicData, id: string) {
  return data.profiles.find((p) => p.id === id)?.full_name || "Korisnik";
}
export function courseName(data: AcademicData, id: string) {
  const c = data.courses.find((c) => c.id === id);
  return c ? `${c.code} · ${c.name}` : "Kolegij";
}
