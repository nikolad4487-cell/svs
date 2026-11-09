import { NextResponse, type NextRequest } from "next/server";
import {
  resolveHost,
  moduleUrl,
  deploymentHosts,
  productionCanonicalBase,
} from "./lib/hosts";
import { isModule } from "./lib/modules";
import {
  centralPath,
  publicRoute,
  facultyUrl,
  validFaculty,
} from "./lib/routes";
import { supabaseConfig } from "./lib/supabase/config";
import { refreshSession } from "./lib/supabase/proxy";
import { sameOrigin } from "./lib/auth/policy";
export async function proxy(request: NextRequest) {
  const host = resolveHost(
    request.headers.get("host") ?? "",
    process.env.BASE_DOMAIN || "isvu.me",
    process.env.LOCAL_BASE_DOMAIN || "",
    deploymentHosts(),
    productionCanonicalBase(),
  );
  const url = request.nextUrl.clone();
  if (
    !host ||
    url.pathname.startsWith("/sites") ||
    url.pathname.startsWith("/unknown-host")
  ) {
    url.pathname = "/unknown-host";
    return NextResponse.rewrite(url);
  }
  const oldModule = url.searchParams.get("module");
  if (
    !host.local &&
    !host.singleDomain &&
    host.module === "home" &&
    url.pathname === "/" &&
    oldModule &&
    isModule(oldModule) &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    const target = new URL(moduleUrl(oldModule, host));
    target.search = url.search;
    target.searchParams.delete("module");
    const faculty = url.searchParams.get("faculty");
    return NextResponse.redirect(
      oldModule === "raspored" && validFaculty(faculty)
        ? facultyUrl(target.toString(), faculty)
        : target,
      308,
    );
  }
  const route = url.pathname.startsWith("/api/")
    ? { module: host.module, faculty: "" }
    : publicRoute(host, url.pathname, url.searchParams);
  if (!route) {
    url.pathname = "/unknown-host";
    return NextResponse.rewrite(url);
  }
  const { module, faculty } = route;
  const fallback = url.searchParams.get("module");
  if (
    host.canonicalBase &&
    !url.pathname.startsWith("/api/") &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    const target = new URL(moduleUrl(module, host));
    target.search = url.search;
    target.searchParams.delete("module");
    return NextResponse.redirect(
      faculty ? facultyUrl(target.toString(), faculty) : target,
      308,
    );
  }
  if (
    !host.local &&
    !host.singleDomain &&
    host.module !== "home" &&
    centralPath(host.module) &&
    !url.pathname.startsWith("/api/")
  ) {
    const target = new URL(moduleUrl(host.module, host));
    target.search = url.search;
    return NextResponse.redirect(target, 308);
  }
  const headers = new Headers(request.headers);
  headers.set("x-svs-faculty", faculty);
  headers.set("x-svs-base", moduleUrl("home", host));
  headers.set(
    "x-svs-fallback",
    host.local && (!!fallback || host.module === "home") ? "1" : "0",
  );
  headers.set("x-svs-host", request.headers.get("host") ?? "");
  if (url.pathname.startsWith("/api/")) {
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      !sameOrigin(
        request.headers.get("origin"),
        `${host.local ? "http" : "https"}://${request.headers.get("host")}`,
      )
    )
      return NextResponse.json(
        { error: "Neispravan izvor zahtjeva." },
        { status: 403 },
      );
    return refreshSession(request, host, () => {
      headers.set("cookie", request.headers.get("cookie") || "");
      return NextResponse.next({ request: { headers } });
    });
  }
  if (module !== "home") url.pathname = `/sites/${module}`;
  return refreshSession(request, host, (authenticated) => {
    if (
      supabaseConfig() &&
      module !== "home" &&
      module !== "auth" &&
      !authenticated
    ) {
      const login = new URL(
        moduleUrl("auth", host, headers.get("x-svs-fallback") === "1"),
      );
      login.searchParams.set("next", module);
      if (faculty) login.searchParams.set("faculty", faculty);
      return NextResponse.redirect(login);
    }
    headers.set("cookie", request.headers.get("cookie") || "");
    return module === "home"
      ? NextResponse.next({ request: { headers } })
      : NextResponse.rewrite(url, { request: { headers } });
  });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
