import { GraduationCap } from "lucide-react";
export function Brand() {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
        <GraduationCap size={25} />
      </span>
      <span>
        <strong className="block text-lg tracking-tight">
          ISVU<span className="text-blue-600">.</span>
        </strong>
        <span className="block max-w-64 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Informacijski sustav visokih ustanova
        </span>
      </span>
    </span>
  );
}
