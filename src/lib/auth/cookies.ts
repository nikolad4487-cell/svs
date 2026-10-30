import type { HostResult } from "../hosts";
export function sessionCookieOptions(host: NonNullable<HostResult>) {
  // Browser support for Domain=localhost is inconsistent. Use .test DNS for real local SSO.
  const domain =
    host.singleDomain || ["localhost", "127.0.0.1"].includes(host.base)
      ? undefined
      : `.${host.base}`;
  return {
    path: "/",
    httpOnly: true,
    secure: !host.local,
    sameSite: "lax" as const,
    ...(domain ? { domain } : {}),
  };
}
