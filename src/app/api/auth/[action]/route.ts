import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { requestContext, assertSameOrigin } from "@/lib/auth/request";
import {
  facultyUrl,
  validFaculty,
  validInstitutionId,
  institutionUrl,
} from "@/lib/routes";
import { safeModule } from "@/lib/auth/policy";
import { requireIdentity } from "@/lib/auth/access";
const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
async function authRedirect(
  status: string,
  mode = "login",
  next = "portal",
  faculty?: string,
  institution?: string,
) {
  const { url } = await requestContext();
  const target = new URL(url("auth"));
  target.searchParams.set("status", status);
  target.searchParams.set("mode", mode);
  target.searchParams.set("next", safeModule(next));
  if (validInstitutionId(institution))
    target.searchParams.set("institution", institution);
  if (next === "raspored" && validFaculty(faculty))
    target.searchParams.set("faculty", faculty);
  return NextResponse.redirect(target, 303);
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!["login", "signup", "reset", "password", "logout"].includes(action))
    return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
  try {
    await assertSameOrigin();
    if (!supabaseConfig())
      return NextResponse.json(
        { error: "Supabase nije konfiguriran." },
        { status: 503 },
      );
    if (Number(request.headers.get("content-length") || 0) > 16384)
      return NextResponse.json({ error: "Prevelik zahtjev." }, { status: 413 });
    const form = await request.formData();
    const next = safeModule(form.get("next"));
    const institution = validInstitutionId(form.get("institution"))
      ? String(form.get("institution"))
      : undefined;
    const faculty =
      next === "raspored" && validFaculty(form.get("faculty"))
        ? String(form.get("faculty"))
        : undefined;
    const db = await supabaseServer();
    if (action === "login") {
      const input = z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(128),
        })
        .safeParse(Object.fromEntries(form));
      if (!input.success)
        return authRedirect("invalid", "login", next, faculty, institution);
      const { data, error } = await db.auth.signInWithPassword(input.data);
      if (error)
        return authRedirect("invalid", "login", next, faculty, institution);
      if (data.user?.app_metadata?.svs_password_change_required === true)
        return authRedirect(
          "temporary-password",
          "password",
          next,
          faculty,
          institution,
        );
      const acceptance = await db.rpc("accept_invitations");
      if (acceptance.error) {
        await db.auth.signOut({ scope: "local" });
        return authRedirect("unavailable", "login", next, faculty, institution);
      }
      if (institution) {
        const allowed = await db.rpc("has_role", { inst: institution });
        if (allowed.error || !allowed.data)
          return authRedirect(
            "institution-denied",
            "login",
            next,
            faculty,
            institution,
          );
      }
      const { url } = await requestContext();
      return NextResponse.redirect(
        institutionUrl(
          faculty ? facultyUrl(url(next), faculty) : url(next),
          institution,
        ),
        303,
      );
    }
    if (action === "signup") {
      if (process.env.AUTH_INVITE_SIGNUP_ENABLED !== "true")
        return authRedirect(
          "registration-disabled",
          "signup",
          next,
          faculty,
          institution,
        );
      const input = credentials
        .extend({ full_name: z.string().trim().min(2).max(200) })
        .safeParse(Object.fromEntries(form));
      if (!input.success)
        return authRedirect("invalid", "signup", next, faculty, institution);
      const { origin } = await requestContext();
      const callback = new URL("/api/auth/callback", origin);
      callback.searchParams.set("next", next);
      if (faculty) callback.searchParams.set("faculty", faculty);
      if (institution) callback.searchParams.set("institution", institution);
      // The mandatory database Auth hook enforces invitations even for direct Auth API requests.
      await db.auth.signUp({
        email: input.data.email,
        password: input.data.password,
        options: {
          data: { full_name: input.data.full_name },
          emailRedirectTo: callback.toString(),
        },
      });
      return authRedirect("check-email", "signup", next, faculty, institution);
    }
    if (action === "reset") {
      const email = z.email().max(254).safeParse(form.get("email"));
      if (!email.success)
        return authRedirect("invalid", "reset", next, faculty, institution);
      const { origin } = await requestContext();
      const callback = new URL("/api/auth/callback", origin);
      callback.searchParams.set("mode", "password");
      callback.searchParams.set("next", next);
      if (faculty) callback.searchParams.set("faculty", faculty);
      if (institution) callback.searchParams.set("institution", institution);
      await db.auth.resetPasswordForEmail(email.data, {
        redirectTo: callback.toString(),
      });
      return authRedirect("check-email", "reset", next, faculty, institution);
    }
    const account = await requireIdentity(undefined, true);
    if (action === "password") {
      const password = z
        .string()
        .min(12)
        .max(128)
        .safeParse(form.get("password"));
      if (!password.success)
        return authRedirect("invalid", "password", next, faculty, institution);
      const { error } = await db.auth.updateUser({ password: password.data });
      if (error)
        return authRedirect("invalid", "password", next, faculty, institution);
      // Password change invalidates all existing sessions, including this browser.
      const revoke = await db.rpc("revoke_my_session", { all_sessions: true });
      if (revoke.error)
        return authRedirect(
          "unavailable",
          "password",
          next,
          faculty,
          institution,
        );
      await db.auth.signOut({ scope: "local" });
      return authRedirect(
        "password-changed",
        "login",
        next,
        faculty,
        institution,
      );
    }
    const global = form.get("scope") !== "local";
    const { error } = await account.db.rpc("revoke_my_session", {
      all_sessions: global,
    });
    if (error) return authRedirect("unavailable");
    await account.db.auth.signOut({ scope: "local" });
    return authRedirect("signed-out");
  } catch {
    return authRedirect("unavailable");
  }
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!["callback", "confirm"].includes(action))
    return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
  try {
    const db = await supabaseServer();
    const next = safeModule(request.nextUrl.searchParams.get("next"));
    const institution = validInstitutionId(
      request.nextUrl.searchParams.get("institution"),
    )
      ? request.nextUrl.searchParams.get("institution")!
      : undefined;
    const faculty =
      next === "raspored" &&
      validFaculty(request.nextUrl.searchParams.get("faculty"))
        ? request.nextUrl.searchParams.get("faculty")!
        : undefined;
    let error;
    if (action === "callback") {
      const code = request.nextUrl.searchParams.get("code");
      if (!code) return authRedirect("expired");
      ({ error } = await db.auth.exchangeCodeForSession(code));
    } else {
      const type = request.nextUrl.searchParams.get("type");
      const token_hash = request.nextUrl.searchParams.get("token_hash");
      if (
        !token_hash ||
        !["signup", "recovery", "invite", "email"].includes(type || "")
      )
        return authRedirect("expired");
      ({ error } = await db.auth.verifyOtp({
        token_hash,
        type: type as "signup" | "recovery" | "invite" | "email",
      }));
    }
    if (error) return authRedirect("expired");
    const accept = await db.rpc("accept_invitations");
    if (accept.error) return authRedirect("unavailable");
    if (
      request.nextUrl.searchParams.get("mode") === "password" ||
      request.nextUrl.searchParams.get("type") === "recovery"
    )
      return authRedirect("verified", "password", next, faculty, institution);
    if (institution) {
      const allowed = await db.rpc("has_role", { inst: institution });
      if (allowed.error || !allowed.data)
        return authRedirect(
          "institution-denied",
          "login",
          next,
          faculty,
          institution,
        );
    }
    const { url } = await requestContext();
    return NextResponse.redirect(
      institutionUrl(
        faculty ? facultyUrl(url(next), faculty) : url(next),
        institution,
      ),
      303,
    );
  } catch {
    return authRedirect("unavailable");
  }
}
