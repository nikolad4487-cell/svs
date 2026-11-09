import { isModule, type ModuleSlug } from "./modules";
import type { HostResult } from "./hosts";
export const centralPaths = {
  portal: "/admin",
  isvu: "/admin/studiji",
  admin: "/admin/sustav",
  webmail: "/webmail",
} as const;
export function centralPath(module: ModuleSlug | "home") {
  return centralPaths[module as keyof typeof centralPaths];
}
export function validFaculty(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= 64 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}
export function facultyUrl(base: string, faculty: string) {
  const target = new URL(base);
  if (validFaculty(faculty)) {
    target.pathname = `/${faculty}`;
    target.searchParams.delete("faculty");
  }
  return target.toString();
}
export function publicRoute(
  host: NonNullable<HostResult>,
  pathname: string,
  query: URLSearchParams,
) {
  if (pathname.startsWith("/sites") || pathname.startsWith("/unknown-host"))
    return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const fallback = host.local || host.singleDomain ? query.get("module") : null;
  if (fallback && !isModule(fallback)) return null;
  let module: ModuleSlug | "home" =
    fallback && isModule(fallback) ? fallback : host.module;
  if (host.module === "home") {
    const central = Object.entries(centralPaths).find(([, p]) => p === path);
    if (central) {
      if (fallback && fallback !== central[0]) return null;
      module = central[0] as ModuleSlug;
      return { module, faculty: "" };
    }
  }
  if (module === "raspored") {
    if (path === "/") {
      const faculty = query.get("faculty");
      if (faculty && !validFaculty(faculty)) return null;
      return { module, faculty: faculty || "" };
    }
    const slug = path.slice(1);
    return validFaculty(slug) ? { module, faculty: slug } : null;
  }
  return path === "/" ? { module, faculty: "" } : null;
}
