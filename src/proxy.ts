import { NextResponse, type NextRequest } from "next/server";
import { resolveHost, moduleUrl, deploymentHosts } from "./lib/hosts";
import { isModule } from "./lib/modules";
import { supabaseConfig } from "./lib/supabase/config";
import { refreshSession } from "./lib/supabase/proxy";
import { sameOrigin } from "./lib/auth/policy";
export async function proxy(request: NextRequest) {
  const host = resolveHost(
    request.headers.get("host") ?? "",
    process.env.BASE_DOMAIN || "domena.hr",
    process.env.LOCAL_BASE_DOMAIN || "",
    deploymentHosts(),
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
  let module = host.module;
  const fallback = url.searchParams.get("module");
  if ((host.local || host.singleDomain) && fallback) {
    if (!isModule(fallback)) {
      url.pathname = "/unknown-host";
      return NextResponse.rewrite(url);
    }
    module = fallback;
  }
  const headers = new Headers(request.headers);
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
  if (module !== "home")
    url.pathname = `/sites/${module}${url.pathname === "/" ? "" : url.pathname}`;
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
