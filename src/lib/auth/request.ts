import "server-only";
import { headers } from "next/headers";
import { resolveHost, deploymentHosts, moduleUrl } from "../hosts";
import { sameOrigin } from "./policy";
export async function requestContext() {
  const h = await headers();
  const host = resolveHost(
    h.get("host") || "",
    process.env.BASE_DOMAIN || "isvu.me",
    process.env.LOCAL_BASE_DOMAIN || "",
    deploymentHosts(),
  );
  if (!host) throw new Error("Nepodržana domena");
  const fallback = h.get("x-svs-fallback") === "1";
  const origin = `${host.local ? "http" : "https"}://${h.get("host")}`;
  return {
    host,
    origin,
    url: (module: Parameters<typeof moduleUrl>[0]) =>
      moduleUrl(module, host, fallback),
  };
}
export async function assertSameOrigin() {
  const h = await headers();
  const { origin } = await requestContext();
  if (!sameOrigin(h.get("origin"), origin))
    throw new Error("Zahtjev je odbijen zbog neispravnog izvora.");
}
