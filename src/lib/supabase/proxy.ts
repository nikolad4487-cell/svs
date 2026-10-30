import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";
import type { HostResult } from "../hosts";
import { sessionCookieOptions } from "../auth/cookies";
export async function refreshSession(
  request: NextRequest,
  host: NonNullable<HostResult>,
  makeResponse: (authenticated: boolean) => NextResponse,
) {
  const config = supabaseConfig();
  let pending: { name: string; value: string; options: CookieOptions }[] = [];
  let authenticated = false;
  if (config) {
    const db = createServerClient(config.url, config.key, {
      cookieOptions: { name: "svs-auth", ...sessionCookieOptions(host) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          pending = values;
          for (const { name, value } of values)
            request.cookies.set(name, value);
        },
      },
    });
    // Validate against Auth; never authorize using only the unverified getSession payload.
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user?.email_confirmed_at) {
      const active = await db.rpc("session_is_active");
      authenticated = !active.error && active.data === true;
    }
  }
  const response = makeResponse(authenticated);
  for (const { name, value, options } of pending)
    response.cookies.set(name, value, {
      ...options,
      ...sessionCookieOptions(host),
    });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie, Host");
  return response;
}
