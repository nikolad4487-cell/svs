import { centralPath } from "./routes";
import { isModule, type ModuleSlug } from "./modules";
export type HostResult = {
  module: ModuleSlug | "home";
  base: string;
  port: string;
  local: boolean;
  singleDomain?: boolean;
  canonicalBase?: string;
} | null;
function hostname(value: string) {
  if (!/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(value)) return null;
  const [name, port = ""] = value.toLowerCase().split(":");
  if (port && (+port < 1 || +port > 65535)) return null;
  if (name.split(".").some((p) => !p || p.startsWith("-") || p.endsWith("-")))
    return null;
  return { name, port: port ? `:${port}` : "" };
}
export function resolveHost(
  host: string,
  baseDomain = "domena.hr",
  localDomain = "",
  deploymentHosts: string[] = [],
  canonicalBase = "",
): HostResult {
  const parsed = hostname(host);
  if (!parsed) return null;
  const bases = [
    "localhost",
    "127.0.0.1",
    ...(localDomain ? [localDomain] : []),
    baseDomain.toLowerCase(),
  ];
  for (const base of bases) {
    const local = base !== baseDomain.toLowerCase();
    if (parsed.name === base || parsed.name === `www.${base}`)
      return { module: "home", base, port: parsed.port, local };
    if (parsed.name.endsWith(`.${base}`)) {
      const sub = parsed.name.slice(0, -base.length - 1);
      if (isModule(sub)) return { module: sub, base, port: parsed.port, local };
    }
  }
  // Only exact deployment hosts injected by Vercel; never trust arbitrary *.vercel.app.
  if (deploymentHosts.some((h) => h && hostname(h)?.name === parsed.name)) {
    return {
      module: "home",
      base: parsed.name,
      port: parsed.port,
      local: false,
      singleDomain: true,
      ...(canonicalBase &&
      hostname(canonicalBase)?.name === baseDomain.toLowerCase()
        ? { canonicalBase: baseDomain.toLowerCase() }
        : {}),
    };
  }
  return null;
}
export function moduleUrl(
  target: ModuleSlug | "home",
  host: NonNullable<HostResult>,
  fallback = false,
) {
  if (host.canonicalBase) {
    const path = centralPath(target);
    return path
      ? `https://${host.canonicalBase}${path}`
      : `https://${target === "home" ? "" : `${target}.`}${host.canonicalBase}`;
  }
  const protocol = host.local ? "http" : "https";
  if (host.singleDomain || (fallback && host.local))
    return `${protocol}://${host.base}${host.port}/${target === "home" ? "" : `?module=${target}`}`;
  const central = centralPath(target);
  if (central && !host.local)
    return `${protocol}://${host.base}${host.port}${central}`;
  return `${protocol}://${target === "home" ? "" : `${target}.`}${host.base}${host.port}`;
}

export function deploymentHosts(): string[] {
  return process.env.VERCEL === "1"
    ? [
        process.env.VERCEL_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
      ].filter((value): value is string => !!value)
    : [];
}

export function productionCanonicalBase() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production"
    ? process.env.BASE_DOMAIN || "isvu.me"
    : "";
}
