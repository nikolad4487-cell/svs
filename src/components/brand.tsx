import { GraduationCap } from "lucide-react";
export function Brand() {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
        <GraduationCap size={25} />
      </span>
      <span>
        <strong className="block text-lg tracking-tight">
          SVS<span className="text-blue-600">.</span>
        </strong>
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Visoko obrazovanje
        </span>
      </span>
    </span>
  );
}
