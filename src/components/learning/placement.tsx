import type { Section } from "@/lib/learning/model";
export function PlacementFields({
  sections,
  sectionId,
  enabled,
}: {
  sections: Section[];
  sectionId?: string | null;
  enabled: boolean;
}) {
  if (!enabled) return null;
  return (
    <>
      <input type="hidden" name="return_edit" value="1" />
      <label className="block text-sm font-medium">
        Cjelina kolegija
        <select
          name="section_id"
          defaultValue={sectionId || ""}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3"
        >
          <option value="">Općenito</option>
          {sections.map((s) => (
            <option value={s.id} key={s.id}>
              {s.title}
              {!s.published ? " (skriveno)" : ""}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
