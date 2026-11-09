"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { learningFileAccept } from "@/lib/learning/files";
import { learningErrors } from "@/lib/learning/validation";
import {
  uploadLearningFiles,
  validateLearningFiles,
} from "@/lib/learning/upload";
import { Button } from "@/components/ui/button";

export function LearningCreateForm({
  kind,
  children,
  filesReady,
  existing = false,
}: {
  kind: "material" | "assignment";
  children: React.ReactNode;
  filesReady: boolean;
  existing?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const uploaded = useRef(new Set<File>());
  const saved = useRef<{ id: string; revision: number } | null>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [percent, setPercent] = useState(0);
  const label = kind === "material" ? "Spremi materijal" : "Spremi zadatak";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const selected = [...(input.current?.files || [])];
    try {
      validateLearningFiles(selected);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    const fields = new FormData(form);
    if (
      kind === "material" &&
      !String(fields.get("body") || "").trim() &&
      !String(fields.get("resource_url") || "").trim() &&
      selected.length
    )
      fields.set(
        "body",
        `Odabrani privitci:\n${selected.map((file) => file.name).join("\n")}`,
      );
    const publishAfterUpload =
      selected.length > 0 && fields.get("published") === "on";
    if (publishAfterUpload) fields.delete("published");
    if (saved.current) {
      fields.set("id", saved.current.id);
      fields.set("revision", String(saved.current.revision));
    }
    const save = async () => {
      const body = new URLSearchParams();
      for (const [key, value] of fields)
        if (typeof value === "string") body.set(key, value);
      const response = await fetch(`/api/learning/${kind}`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body,
      });
      const result = await response.json();
      if (!response.ok || !result.id)
        throw new Error(
          learningErrors[result.status] ||
            result.error ||
            "Promjena nije spremljena.",
        );
      saved.current = { id: result.id, revision: result.revision };
      return result;
    };
    setBusy(true);
    setMessage("Spremanje…");
    try {
      let result = await save();
      if (selected.length)
        await uploadLearningFiles({
          kind,
          target: result.id,
          files: selected.filter((file) => !uploaded.current.has(file)),
          onUploaded: (file) => uploaded.current.add(file),
          onProgress: (name, value) => {
            setMessage(`Učitavanje: ${name}`);
            setPercent(value);
          },
          onRequest: (xhr) => {
            request.current = xhr;
          },
        });
      if (publishAfterUpload) {
        fields.set("id", result.id);
        fields.set("revision", String(result.revision));
        fields.set("published", "on");
        result = await save();
      }
      window.location.assign(result.redirect);
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "Spremanje nije dovršeno."}${saved.current ? " Zapis je spremljen kao nacrt. Provjerite njegove privitke prije ponovnog učitavanja." : ""}`,
      );
      setBusy(false);
      if (saved.current) router.refresh();
    }
  }
  if (existing)
    return (
      <form
        action={`/api/learning/${kind}`}
        method="post"
        className="space-y-4"
      >
        {children}
        <Button type="submit">{label}</Button>
      </form>
    );
  return (
    <form
      action={`/api/learning/${kind}`}
      method="post"
      onSubmit={submit}
      className="space-y-4"
    >
      <fieldset disabled={busy} className="space-y-4">
        {children}
        <label className="block text-sm font-medium">
          Slike, videa i datoteke
          <input
            ref={input}
            className="mt-2 block w-full min-w-0 text-sm"
            type="file"
            accept={learningFileAccept}
            multiple
            disabled={!filesReady}
          />
        </label>
        <p className="text-xs leading-5 text-slate-500">
          Do 1 GB po datoteci, najviše 20 privitaka. Datoteke se učitavaju nakon
          klika na „{label}”.{" "}
          {kind === "material" &&
            "Ako ne unesete tekst, spremit će se popis odabranih datoteka."}
        </p>
        {!filesReady && (
          <p role="status" className="text-sm text-amber-800">
            Učitavanje još nije uključeno. Administrator sustava treba uključiti
            pohranu privitaka.
          </p>
        )}
        <Button type="submit">{label}</Button>
      </fieldset>
      {busy && (
        <progress
          className="w-full"
          value={percent}
          max={100}
          aria-label="Napredak učitavanja"
        />
      )}
      {busy && request.current && (
        <button
          type="button"
          onClick={() => request.current?.abort()}
          className="text-sm underline"
        >
          Prekini učitavanje
        </button>
      )}
      {message && (
        <p
          role={busy ? "status" : "alert"}
          className="text-sm"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </form>
  );
}
