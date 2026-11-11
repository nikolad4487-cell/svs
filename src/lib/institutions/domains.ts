import { modules } from "../modules";
export const reservedSubdomains = new Set([
  "www",
  "api",
  "app",
  "mail",
  "smtp",
  "imap",
  "pop",
  "ns1",
  "ns2",
  "static",
  "assets",
  "localhost",
  "support",
  "status",
  "autodiscover",
  "tenant",
  ...modules.map((m) => m.slug),
]);
export function asciiSlug(value: string) {
  return value
    .toLowerCase()
    .replaceAll("đ", "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function validSubdomain(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= 63 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    !reservedSubdomains.has(value)
  );
}
export function officialWebsite(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.includes(".") ||
      !u.hostname.split(".").every(part=>part.length>0 && part.length<=63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)) ||
      /^[\d.]+$/.test(u.hostname) ||
      /[\s]/.test(value)
    )
      return null;
    return u.toString();
  } catch {
    return null;
  }
}
export function websiteLabel(website: string) {
  const normalized = officialWebsite(website);
  if (!normalized) return null;
  const parts = new URL(normalized).hostname.toLowerCase().split(".");
  while (parts.length > 2 && /^(www\d*|web|portal)$/.test(parts[0]))
    parts.shift();
  const label = asciiSlug(parts[0]);
  return validSubdomain(label) ? label : null;
}
export function allocateSubdomain(
  base: string,
  used: Set<string>,
  qualifier: string,
  stableSuffix: string,
) {
  let candidate = asciiSlug(base).slice(0, 63).replace(/-+$/, "");
  let exception = false;
  if (!validSubdomain(candidate) || used.has(candidate)) {
    exception = true;
    const suffix = asciiSlug(qualifier) || stableSuffix;
    candidate =
      `${candidate.slice(0, Math.max(2, 62 - suffix.length))}-${suffix}`
        .slice(0, 63)
        .replace(/-+$/, "");
  }
  if (!validSubdomain(candidate) || used.has(candidate)) {
    exception = true;
    candidate = `${candidate.slice(0, 52)}-${stableSuffix}`;
  }
  if (!validSubdomain(candidate) || used.has(candidate))
    throw Error("Unable to allocate a unique subdomain");
  used.add(candidate);
  return { subdomain: candidate, collision: exception };
}
