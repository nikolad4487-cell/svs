import { Button } from "@/components/ui/button";
export const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";
export function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  autoComplete,
  minLength,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={inputClass}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
      />
    </label>
  );
}
export function Submit({ children }: { children: React.ReactNode }) {
  return <Button type="submit">{children}</Button>;
}
