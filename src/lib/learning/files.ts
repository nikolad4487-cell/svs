import { z } from "zod";
export const learningBucket = "merlin-files";
export const maxLearningFileBytes = 1024 * 1024 * 1024;
export const learningMimeTypes: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "application/pdf": ["pdf"],
  "text/plain": ["txt"],
  "application/zip": ["zip"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "pptx",
  ],
};
export const learningFileAccept = Object.values(learningMimeTypes)
  .flat()
  .map((x) => `.${x}`)
  .join(",");
export const learningFileMetadata = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((v) => !/[\u0000-\u001f\u007f/\\]/.test(v)),
    type: z.string().max(200),
    size: z.number().int().min(1).max(maxLearningFileBytes),
  })
  .transform((v, ctx) => {
    const extension = v.name.split(".").at(-1)?.toLowerCase();
    const type = Object.entries(learningMimeTypes).find(([, ext]) =>
      ext.includes(extension || ""),
    )?.[0];
    if (
      !type ||
      (v.type &&
        v.type !== "application/octet-stream" &&
        !(
          v.type === "application/x-zip-compressed" &&
          type === "application/zip"
        ) &&
        v.type !== type)
    ) {
      ctx.addIssue({ code: "custom", message: "Nepodržana vrsta datoteke." });
      return z.NEVER;
    }
    return { ...v, type };
  });
export const fileRequest = z
  .object({ kind: z.enum(["material", "assignment"]), target: z.uuid() })
  .and(learningFileMetadata);
export type LearningFile = {
  id: string;
  course_id: string;
  material_id: string | null;
  assignment_id: string | null;
  file_name: string;
  mime_type: string;
  byte_size: number;
  status: "pending" | "ready";
  object_path: string;
  uploaded_by: string;
};
export function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
