import { fileRequest, learningFileMetadata } from "./files";

export async function learningFileAction(action: string, body: unknown) {
  const response = await fetch(`/api/learning/files/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Radnja nije dovršena.");
  return result;
}

export function validateLearningFiles(files: File[]) {
  if (files.length > 20)
    throw new Error("Najviše 20 privitaka po materijalu ili zadatku.");
  for (const file of files) {
    if (
      !learningFileMetadata.safeParse({
        name: file.name,
        type: file.type,
        size: file.size,
      }).success
    )
      throw new Error(
        "Odaberite podržanu sliku, video ili dokument veličine do 1 GB. Prazne datoteke nisu podržane.",
      );
  }
}

export async function uploadLearningFiles({
  kind,
  target,
  files,
  onProgress,
  onRequest,
  onUploaded,
}: {
  kind: "material" | "assignment";
  target: string;
  files: File[];
  onProgress: (name: string, percent: number) => void;
  onRequest: (request: XMLHttpRequest | null) => void;
  onUploaded?: (file: File) => void;
}) {
  validateLearningFiles(files);
  let reservation: string | undefined;
  try {
    for (const file of files) {
      const meta = fileRequest.parse({
        kind,
        target,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      onProgress(file.name, 0);
      const prepared = await learningFileAction("prepare", meta);
      reservation = prepared.id;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        onRequest(xhr);
        xhr.open("PUT", prepared.url);
        xhr.setRequestHeader("content-type", prepared.type);
        xhr.setRequestHeader("cache-control", "max-age=0");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(file.name, Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(
                new Error(
                  "Učitavanje nije uspjelo. Provjerite vezu i raspoloživi prostor pohrane.",
                ),
              );
        xhr.onerror = () =>
          reject(
            new Error("Veza s pohranom nije dostupna. Pokušajte ponovno."),
          );
        xhr.onabort = () => reject(new Error("Učitavanje je prekinuto."));
        xhr.send(file);
      });
      onRequest(null);
      await learningFileAction("complete", { id: reservation });
      onUploaded?.(file);
      reservation = undefined;
    }
  } catch (error) {
    if (reservation) {
      try {
        await learningFileAction("remove", { id: reservation });
      } catch {}
    }
    throw error;
  } finally {
    onRequest(null);
  }
}
