import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { requireIdentity } from "@/lib/auth/access";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    const { action } = await params;
    const account = await requireIdentity();
    const form = await req.formData();
    let error;
    if (action === "profile") {
      const full_name = z
        .string()
        .trim()
        .min(2)
        .max(200)
        .parse(form.get("full_name"));
      ({ error } = await account.db
        .from("profiles")
        .update({ full_name })
        .eq("id", account.user.id));
    } else if (action === "revoke-session") {
      const target = z.uuid().parse(form.get("session_id"));
      ({ error } = await account.db.rpc("revoke_my_session", { target }));
    } else
      return NextResponse.json({ error: "Nije pronađeno." }, { status: 404 });
    const { url } = await requestContext();
    const target = new URL(url("auth"));
    target.searchParams.set("mode", "account");
    target.searchParams.set("status", error ? "unavailable" : "saved");
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json(
      { error: "Zahtjev nije dopušten." },
      { status: 403 },
    );
  }
}
