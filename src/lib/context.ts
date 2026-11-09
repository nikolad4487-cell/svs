import { facultyUrl } from "./routes";
import { headers } from "next/headers";
import {
  resolveHost,
  moduleUrl,
  deploymentHosts,
  productionCanonicalBase,
} from "./hosts";
export async function navigation() {
  const h = await headers();
  const host = resolveHost(
    h.get("x-svs-host") || h.get("host") || "",
    process.env.BASE_DOMAIN || "isvu.me",
    process.env.LOCAL_BASE_DOMAIN || "",
    deploymentHosts(),
    productionCanonicalBase(),
  );
  if (!host) throw new Error("Nepodržan hostname");
  return (slug: Parameters<typeof moduleUrl>[0]) => {
    const base = moduleUrl(slug, host, h.get("x-svs-fallback") === "1");
    return slug === "raspored" && h.get("x-svs-faculty")
      ? facultyUrl(base, h.get("x-svs-faculty")!)
      : base;
  };
}
