import { headers } from "next/headers";
import { resolveHost, moduleUrl, deploymentHosts } from "./hosts";
export async function navigation() {
  const h = await headers();
  const host = resolveHost(
    h.get("x-svs-host") || h.get("host") || "",
    process.env.BASE_DOMAIN || "domena.hr",
    process.env.LOCAL_BASE_DOMAIN || "",
    deploymentHosts(),
  );
  if (!host) throw new Error("Nepodržan hostname");
  return (slug: Parameters<typeof moduleUrl>[0]) =>
    moduleUrl(slug, host, h.get("x-svs-fallback") === "1");
}
