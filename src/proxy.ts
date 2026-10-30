import { NextResponse, type NextRequest } from "next/server";
import { resolveHost, moduleUrl, deploymentHosts } from "./lib/hosts";
import { isModule } from "./lib/modules";
export function proxy(request: NextRequest) {
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
  headers.set("x-svs-fallback", host.local && !!fallback ? "1" : "0");
  headers.set("x-svs-host", request.headers.get("host") ?? "");
  if (module !== "home")
    url.pathname = `/sites/${module}${url.pathname === "/" ? "" : url.pathname}`;
  return module === "home"
    ? NextResponse.next({ request: { headers } })
    : NextResponse.rewrite(url, { request: { headers } });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
