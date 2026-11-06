export class AdmissionConfigurationError extends Error {}

export function sourceConfiguration(env: Record<string, string | undefined>) {
  const missing = [
    "EMATICA_SUPABASE_URL",
    "EMATICA_SUPABASE_SECRET_KEY",
  ].filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new AdmissionConfigurationError(
      `U Vercel → Settings → Environment Variables za Production nedostaje: ${missing.join(", ")}. Dodajte varijable i napravite Redeploy. Postavke cloud razvojnog okruženja ne prenose se automatski na Vercel.`,
    );
  }
  let url: URL;
  try {
    url = new URL(env.EMATICA_SUPABASE_URL!.trim());
    if (url.username || url.password) throw new Error("credentials");
    if (
      url.protocol !== "https:" &&
      !(
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.protocol === "http:"
      )
    )
      throw new Error("protocol");
  } catch {
    throw new AdmissionConfigurationError(
      "EMATICA_SUPABASE_URL u Vercelu nije ispravan Supabase HTTPS URL. Unesite URL Supabase projekta e-Matice, zatim napravite Redeploy.",
    );
  }
  return { origin: url.origin, key: env.EMATICA_SUPABASE_SECRET_KEY!.trim() };
}
