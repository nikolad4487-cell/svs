import { createHash } from "node:crypto";

export function loginName(first, last, studentId, domain) {
  const part = (s) =>
    s
      .toLowerCase()
      .replace(/đ/g, "dj")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
  const base =
    [part(first), part(last)].filter(Boolean).join(".").slice(0, 40) ||
    "student";
  const suffix = createHash("sha256")
    .update(studentId)
    .digest("hex")
    .slice(0, 12);
  return `${base}.${suffix}@${domain}`;
}
