import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { requireIdentity } from "@/lib/auth/access";
import { roles } from "@/lib/auth/policy";
import { emailDomainsInput } from "@/lib/auth/email-domains";
const institutionSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().regex(/^[A-Z0-9-]{2,20}$/),
  registrar_contact: z.string().trim().max(2000).default(""),
  student_instructions: z.string().trim().max(5000).default(""),
  identity_portal_url: z
    .union([
      z.url().refine((v) => new URL(v).protocol === "https:"),
      z.literal(""),
    ])
    .default(""),
  email_domains: emailDomainsInput.default([]),
  headquarters: z.string().trim().max(200),
  contact_email: z
    .union([z.email().max(254), z.literal("")])
    .transform((v) => v || null),
});
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    const account = await requireIdentity();
    const { action } = await params;
    const form = await req.formData();
    let error;
    const institution_id = () => z.uuid().parse(form.get("institution_id"));
    const canManage = (id: string) =>
      account.superadmin ||
      account.memberships.some(
        (m) => m.institution_id === id && m.role === "institution_admin",
      );
    if (action === "institution") {
      const input = institutionSchema.parse(Object.fromEntries(form));
      const id = form.get("institution_id");
      if (id) {
        const inst = z.uuid().parse(id);
        if (!canManage(inst)) throw new Error("Forbidden");
        ({ error } = await account.db
          .from("institutions")
          .update(input)
          .eq("id", inst));
      } else {
        if (!account.superadmin) throw new Error("Forbidden");
        ({ error } = await account.db.from("institutions").insert(input));
      }
    } else if (action === "invite") {
      const id = institution_id();
      const role = z.enum(roles).parse(form.get("role"));
      if (
        !canManage(id) ||
        (!account.superadmin && role === "institution_admin")
      )
        throw new Error("Forbidden");
      const email = z.email().max(254).parse(form.get("email")).toLowerCase();
      ({ error } = await account.db.from("registration_invites").insert({
        institution_id: id,
        email,
        role,
        created_by: account.user.id,
      }));
    } else if (action === "membership") {
      if (!account.superadmin) throw new Error("Forbidden");
      const input = {
        institution_id: institution_id(),
        user_id: z.uuid().parse(form.get("user_id")),
        role: z.enum(roles).parse(form.get("role")),
      };
      if (form.get("operation") === "remove")
        ({ error } = await account.db
          .from("memberships")
          .delete()
          .match(input));
      else ({ error } = await account.db.from("memberships").upsert(input));
    } else
      return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
    const { url } = await requestContext();
    const target = new URL(url(account.superadmin ? "admin" : "portal"));
    target.searchParams.set("status", error ? "invalid" : "saved");
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json(
      { error: "Nemate ovlasti ili obrazac nije ispravan." },
      { status: 403 },
    );
  }
}
