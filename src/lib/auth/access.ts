import "server-only";
import { cache } from "react";
import { supabaseServer } from "../supabase/server";
import { supabaseConfig } from "../supabase/config";
import { canAccessModule, type Membership } from "./policy";
import type { ModuleSlug } from "../modules";
export const identity = cache(async () => {
  if (!supabaseConfig()) return null;
  const db = await supabaseServer();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return null;
  const temporaryPassword = user.app_metadata?.svs_password_change_required === true;
  const session = await db.rpc(temporaryPassword ? "password_change_session_is_active" : "session_is_active");
  if (session.error)
    throw new Error(
      "Provjera sesije nije dostupna. Primijenite migracije baze.",
    );
  if (!session.data) return null;
  if (temporaryPassword) return {
    db, user, profile: { id: user.id, full_name: String(user.user_metadata?.full_name || "") },
    memberships: [] as Membership[], superadmin: false,
  };
  const [profile, member, superadmin] = await Promise.all([
    db.from("profiles").select("id,full_name").eq("id", user.id).single(),
    db.from("memberships").select("institution_id,user_id,role"),
    db.rpc("is_superadmin"),
  ]);
  if (member.error || profile.error || superadmin.error)
    throw new Error("Korisničke ovlasti nisu dostupne.");
  return {
    db,
    user,
    profile: profile.data,
    memberships: member.data as Membership[],
    superadmin: !!superadmin.data,
  };
});
export async function requireIdentity(module?: ModuleSlug, allowTemporaryPassword = false) {
  const account = await identity();
  if (!account) throw new Error("Potrebna je prijava.");
  if (!allowTemporaryPassword && account.user.app_metadata?.svs_password_change_required === true)
    throw new Error("Najprije promijenite privremenu lozinku.");
  if (
    module &&
    !canAccessModule(module, account.superadmin, account.memberships)
  )
    throw new Error("Nemate ovlasti za ovaj modul.");
  return account;
}
