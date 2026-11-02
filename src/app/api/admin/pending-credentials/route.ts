import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { requireIdentity } from "@/lib/auth/access";
import { supabaseConfig } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "Pragma": "no-cache" };
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
  try {
    await assertSameOrigin();
    const account = await requireIdentity("admin");
    if (!account.superadmin) return fail("Samo glavni administrator može izdati početne podatke.", 403);
    if (Number(request.headers.get("content-length") || 0) > 4096) return fail("Prevelik zahtjev.", 413);
    const input = z.object({ invite_id: z.uuid(), activate: z.literal(true) }).parse(await request.json());
    const config = supabaseConfig(), key = process.env.SVS_SUPABASE_SECRET_KEY;
    if (!config || !key) return fail("U Vercel serverske varijable dodajte SVS_SUPABASE_SECRET_KEY iz SVS projekta. Javni anon ključ nije dovoljan.", 503);
    if (process.env.SVS_SUPABASE_URL && new URL(process.env.SVS_SUPABASE_URL).origin !== new URL(config.url).origin)
      return fail("Serverski i javni Supabase URL moraju pripadati istom SVS projektu.", 503);
    const admin = createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const ready = await account.db.rpc("password_change_session_is_active");
    if (ready.error) return fail("Najprije primijenite migracije za privremene lozinke i početne podatke (202611020002 i 202611020003).", 503);
    // Verify credentials before reserving an invitation. No mail is sent by these Admin APIs.
    const access = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (access.error) return fail("Serverski Supabase ključ ne omogućuje upravljanje SVS računima.", 503);
    const claim = await account.db.rpc("claim_pending_credentials", { invite_id: input.invite_id });
    if (claim.error?.code === "PGRST202") return fail("Primijenite migraciju 202611020003_pending_credentials.sql.", 503);
    const invite = claim.data?.[0];
    if (claim.error || !invite) return fail("Poziv je istekao, račun je već potvrđen ili su početni podaci već izdani. Postojeća lozinka nije promijenjena.", 409);
    const password = randomBytes(18).toString("base64url");
    let fullName = "";
    let user;
    if (invite.existing_user_id) {
      const existing = await admin.auth.admin.getUserById(invite.existing_user_id);
      if (existing.error || !existing.data.user || existing.data.user.email_confirmed_at)
        return fail("Račun više nije na čekanju. Početni podaci nisu izdani.", 409);
      fullName = existing.data.user.user_metadata?.full_name || "";
      const result = await admin.auth.admin.updateUserById(invite.existing_user_id, {
        password, email_confirm: true,
        app_metadata: { ...existing.data.user.app_metadata, svs_password_change_required: true },
      });
      if (result.error) return fail("Izdavanje nije potvrđeno. Ne ponavljajte zahtjev; administrator treba provjeriti stanje računa.", 502);
      // Password changes clear the requirement in an Auth trigger. Set it again
      // only after the password update has completed.
      const restricted = await admin.auth.admin.updateUserById(invite.existing_user_id, {
        app_metadata: { ...existing.data.user.app_metadata, svs_password_change_required: true },
      });
      if (restricted.error) return fail("Lozinka je promijenjena, ali ograničenje prvog pristupa nije potvrđeno. Potrebna je administratorska provjera.", 502);
      user = restricted.data.user;
    } else {
      const result = await admin.auth.admin.createUser({ email: invite.email, password, email_confirm: true,
        app_metadata: { svs_password_change_required: true } });
      if (result.error) return fail("Izdavanje nije potvrđeno. Ne ponavljajte zahtjev; administrator treba provjeriti stanje računa.", 502);
      user = result.data.user;
    }
    if (!user) return fail("Izdavanje računa nije potvrđeno.", 502);
    const institution = await account.db.from("institutions").select("name").eq("id", invite.institution_id).single();
    const { url } = await requestContext();
    return NextResponse.json({ userId: user.id, sheet: { email: invite.email, password, full_name: String(fullName).slice(0, 200),
      institution: institution.data?.name || "" }, loginUrl: url("auth") }, { headers });
  } catch {
    return fail("Nemate ovlasti ili zahtjev nije ispravan.", 403);
  }
}
