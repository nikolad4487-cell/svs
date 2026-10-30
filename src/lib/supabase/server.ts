import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import { requestContext } from "../auth/request";
import { sessionCookieOptions } from "../auth/cookies";
export async function supabaseServer() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase nije konfiguriran.");
  const store = await cookies();
  const { host } = await requestContext();
  return createServerClient(config.url, config.key, {
    cookieOptions: { name: "svs-auth", ...sessionCookieOptions(host) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values)
            store.set(name, value, {
              ...options,
              ...sessionCookieOptions(host),
            });
        } catch {
          /* Proxy handles refresh while Server Components only read. */
        }
      },
    },
  });
}
