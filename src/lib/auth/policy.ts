import type { ModuleSlug } from "../modules";
export const roles = [
  "institution_admin",
  "registrar",
  "teacher",
  "student",
] as const;
export type Role = (typeof roles)[number];
export type Membership = {
  institution_id: string;
  user_id: string;
  role: Role;
};
export const roleNames: Record<Role, string> = {
  institution_admin: "Administrator ustanove",
  registrar: "Djelatnik referade",
  teacher: "Nastavnik",
  student: "Student",
};
export function canAccessModule(
  module: ModuleSlug,
  superadmin: boolean,
  memberships: Membership[],
) {
  if (superadmin) return true;
  if (module === "admin") return false;
  if (module === "isvu")
    return memberships.some((m) =>
      ["institution_admin", "registrar"].includes(m.role),
    );
  return module === "auth" || memberships.length > 0;
}
export function safeModule(value: unknown): ModuleSlug {
  return typeof value === "string" &&
    [
      "portal",
      "studomat",
      "merlin",
      "webmail",
      "isvu",
      "referada",
      "raspored",
      "admin",
    ].includes(value)
    ? (value as ModuleSlug)
    : "portal";
}
export function sameOrigin(origin: string | null, expected: string) {
  try {
    return !!origin && new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
