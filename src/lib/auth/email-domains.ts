import { z } from "zod";

// Exact ASCII hostnames; international domains can be entered in punycode.
export const emailDomain = z.string().trim().toLowerCase().max(253).regex(
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
);
export const emailDomainsInput = z.string().max(6000).transform((value) =>
  [...new Set(value.split(/[\s,;]+/).filter(Boolean).map((domain) => emailDomain.parse(domain)))],
).pipe(z.array(emailDomain).max(20));
