"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fileSize,
  learningFileAccept,
  type LearningFile,
} from "@/lib/learning/files";
import { Button } from "@/components/ui/button";
import {
  learningFileAction as action,
  uploadLearningFiles,
} from "@/lib/learning/upload";

export function LearningAttachments({
  target,
  kind,
  files,
  manage,
  ready,
}: {
  target: string;
  kind: "material" | "assignment";
  files: LearningFile[];
  manage: boolean;
  ready: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [percent, setPercent] = useState(0);
  const request = useRef<XMLHttpRequest | null>(null);
  async function upload() {
    const selected = [...(input.current?.files || [])];
    if (!selected.length) {
      setMessage("Odaberite datoteku za učitavanje.");
      return;
    }
    if (files.length + selected.length > 20) {
      setMessage("Najviše 20 privitaka po materijalu ili zadatku.");
      return;
    }
    setBusy(true);
    try {
      await uploadLearningFiles({
        kind,
        target,
        files: selected,
        onProgress: (name, value) => {
          setMessage(`Učitavanje: ${name}`);
          setPercent(value);
        },
        onRequest: (xhr) => {
          request.current = xhr;
        },
      });
      if (input.current) input.current.value = "";
      setMessage("Privitci su spremljeni.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Učitavanje nije uspjelo.",
      );
    } finally {
      setBusy(false);
      request.current = null;
      router.refresh();
    }
  }
  async function remove(file: LearningFile) {
    if (!window.confirm(`Ukloniti privitak „${file.file_name}”?`)) return;
    setBusy(true);
    try {
      await action("remove", { id: file.id });
      setMessage("Privitak je uklonjen.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Privitak nije uklonjen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Privitci"
      className="space-y-4 border-t border-slate-200 pt-4"
    >
      {(files.length > 0 || manage) && (
        <h4 className="font-semibold">Slike, videa i datoteke</h4>
      )}
      {files.map((file) => {
        const link = `/api/learning/files/${file.id}`;
        return (
          <div
            key={file.id}
            className="space-y-3 rounded-lg border border-slate-200 p-4"
          >
            {file.status === "ready" && file.mime_type.startsWith("image/") && (
              <a href={link} target="_blank" rel="noopener noreferrer">
                <img
                  src={`${link}?inline=1`}
                  alt={file.file_name}
                  loading="lazy"
                  width={640}
                  height={360}
                  className="max-h-96 max-w-full rounded-lg object-contain"
                />
              </a>
            )}
            {file.status === "ready" && file.mime_type.startsWith("video/") && (
              <video
                controls
                preload="none"
                className="max-h-96 w-full rounded-lg"
                aria-label={file.file_name}
              >
                <source src={`${link}?inline=1`} type={file.mime_type} />
                Vaš preglednik ne podržava ovaj video. Preuzmite datoteku.
              </video>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {file.status === "ready" ? (
                <a
                  className="break-all text-blue-700 underline"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preuzmi: {file.file_name}
                </a>
              ) : (
                <span className="break-all text-amber-800">
                  {file.file_name} · Nedovršeno učitavanje
                </span>
              )}
              <span className="text-slate-500">{fileSize(file.byte_size)}</span>
              {manage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(file)}
                  className="text-red-700 underline disabled:opacity-50"
                >
                  Ukloni privitak
                </button>
              )}
            </div>
          </div>
        );
      })}
      {manage &&
        (ready ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Dodaj slike, videa ili dokumente
              <input
                ref={input}
                className="mt-2 block w-full min-w-0 text-sm"
                type="file"
                accept={learningFileAccept}
                multiple
                disabled={busy}
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              Do 1 GB po datoteci i 20 privitaka. Slike: JPG, PNG, GIF, WebP.
              Video: MP4, WebM. Dokumenti: PDF, Word, Excel, PowerPoint, TXT i
              ZIP.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" size="sm" disabled={busy} onClick={upload}>
                Učitaj privitke
              </Button>
              {busy && request.current && (
                <button
                  type="button"
                  onClick={() => request.current?.abort()}
                  className="text-sm underline"
                >
                  Prekini učitavanje
                </button>
              )}
            </div>
            {busy && (
              <progress
                className="w-full"
                value={percent}
                max={100}
                aria-label="Napredak učitavanja"
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-amber-800">
            Učitavanje privitaka još nije uključeno. Obratite se administratoru
            sustava.
          </p>
        ))}
      {message && (
        <p role="status" className="text-sm" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
