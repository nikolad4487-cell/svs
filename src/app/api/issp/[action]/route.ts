import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { isspMutation } from "@/lib/issp/service";
import { z } from "zod";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    if (
      !req.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return NextResponse.json(
        { error: "Neispravan obrazac." },
        { status: 415 },
      );
    if (Number(req.headers.get("content-length") || 0) > 64000)
      return NextResponse.json({ error: "Prevelik obrazac." }, { status: 413 });
    const text = await req.text();
    if (Buffer.byteLength(text) > 64000)
      return NextResponse.json({ error: "Prevelik obrazac." }, { status: 413 });
    const form = new FormData();
    for (const [key, value] of new URLSearchParams(text)) {
      if (form.has(key)) throw Error("duplicate");
      form.set(key, value);
    }
    const { url } = await requestContext();
    const target = new URL(url("issp"));
    for (const [field, param] of [
      ["institution_id", "institution"],
      ["student_id", "student"],
      ["academic_year_id", "academic_year"],
    ]) {
      const parsed = z.uuid().safeParse(form.get(field));
      if (parsed.success) target.searchParams.set(param, parsed.data);
    }
    const view = form.get("return_view");
    if (
      [
        "Pregled osobnih podataka",
        "Osobni računi",
        "Postavke obavijesti",
        "Upravljanje evidencijom",
      ].includes(String(view))
    )
      target.searchParams.set("view", String(view));
    let status;
    try {
      status = await isspMutation((await params).action, form);
    } catch (e) {
      if (
        e instanceof z.ZodError ||
        (e instanceof Error &&
          ["ISSP_INVALID", "Neispravan rok."].includes(e.message))
      )
        status = "invalid";
      else throw e;
    }
    target.searchParams.set("status", status);
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json(
      { error: "ISSP promjena nije dopuštena. Provjerite prijavu i ovlasti." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
}
