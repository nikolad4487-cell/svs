"use client";
import { useState } from "react";
import { UserRound } from "lucide-react";
export function StudentPortrait({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="p-6 text-center text-slate-400">
      <UserRound className="mx-auto mb-4" size={90} />
      <p className="text-sm">Fotografija trenutačno nije dostupna</p>
    </div>
  ) : (
    <img
      src={src}
      alt={`Fotografija: ${name}`}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}
