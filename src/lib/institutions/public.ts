import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../supabase/config";
import { validSubdomain } from "./domains";
export type PublicInstitution = {
  id: string;
  registry_key: string | null;
  name: string;
  registry_name: string | null;
  short_name: string;
  parent_name: string | null;
  parent_institution_id: string | null;
  headquarters: string;
  official_website: string | null;
  address?: string | null;
  registry_contact_email?: string | null;
  registry_phone?: string | null;
  website_verification_status: string;
  source_url: string | null;
  isvu_institution_id: string | null;
  subdomain: string;
  full_domain: string;
  domain_verification_status: string;
  domain_origin: string;
  domain_notes: string;
};
export async function institutionDirectory(
  slug?: string,
): Promise<PublicInstitution[]> {
  const config = supabaseConfig();
  if (!config) return [];
  if (slug && !validSubdomain(slug)) return [];
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  });
  const rows: PublicInstitution[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await db
      .rpc("institution_directory", { search: "", tenant_slug: slug || null })
      .range(offset, offset + 499);
    if (r.error) {
      if (["PGRST202", "42883", "42P01"].includes(r.error.code)) return [];
      throw Error("Javni katalog ustanova nije dostupan.");
    }
    rows.push(...r.data);
    if (r.data.length < 500) return rows;
  }
}
