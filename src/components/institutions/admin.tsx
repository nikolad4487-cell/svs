import { requireIdentity } from "@/lib/auth/access";
import { RegistryAdminTable } from "./admin-table";
export type RegistryRow = {
  id: string;
  name: string;
  code: string;
  registry_key: string | null;
  registry_name: string | null;
  isvu_institution_id: string | null;
  short_name: string;
  headquarters: string;
  address: string | null;
  parent_name: string | null;
  parent_institution_id: string | null;
  official_website: string | null;
  website_verification_status: string;
  subdomain: string | null;
  domain_verification_status: string;
  domain_notes: string;
  domain_origin: string;
  source_url: string | null;
  source_snapshot: Record<string, unknown>;
  registry_metadata_locked: boolean;
  active: boolean;
  updated_at: string;
};
export async function RegistryAdmin() {
  const account = await requireIdentity("admin");
  if (!account.superadmin) return null;
  const rows: RegistryRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await account.db
      .from("institutions")
      .select(
        "id,name,code,registry_key,registry_name,isvu_institution_id,short_name,headquarters,address,parent_name,parent_institution_id,official_website,website_verification_status,subdomain,domain_verification_status,domain_notes,domain_origin,source_url,source_snapshot,registry_metadata_locked,active,updated_at",
      )
      .order("id")
      .range(offset, offset + 499);
    if (r.error) {
      if (["42703", "PGRST204"].includes(r.error.code))
        return (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Katalog i poddomene zahtijevaju migracije
            202611110002_institution_tenants.sql a
            202611110003_institution_catalog_125.sql.
          </p>
        );
      throw Error("Katalog ustanova nije dostupan.");
    }
    rows.push(...r.data);
    if (r.data.length < 500) break;
  }
  return <RegistryAdminTable rows={rows} />;
}
