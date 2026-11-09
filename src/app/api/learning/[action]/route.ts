import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { learningMutation } from "@/lib/learning/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    if (
      !request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return NextResponse.json(
        { error: "Neispravan obrazac." },
        { status: 415 },
      );
    if (Number(request.headers.get("content-length") || 0) > 131072)
      return NextResponse.json({ error: "Prevelik obrazac." }, { status: 413 });
    const body = await request.text();
    if (Buffer.byteLength(body) > 131072)
      return NextResponse.json({ error: "Prevelik obrazac." }, { status: 413 });
    const form = new FormData();
    for (const [key, value] of new URLSearchParams(body)) {
      if (form.has(key)) throw new Error("Dvostruko polje.");
      form.set(key, value);
    }
    const { url } = await requestContext();
    const target = new URL(url("merlin"));
    const course = z.uuid().safeParse(form.get("course_id"));
    if (course.success) target.searchParams.set("course", course.data);
    const view = form.get("return_view");
    if (
      ["Moji kolegiji", "Materijali", "Zadaci", "Predaje"].includes(
        String(view),
      )
    )
      target.searchParams.set("view", String(view));
    let result: { status: string; id?: string; revision?: number };
    try {
      result = await learningMutation((await params).action, form);
    } catch (error) {
      if (!(error instanceof z.ZodError)) throw error;
      result = { status: "invalid" };
    }
    target.searchParams.set("status", result.status);
    if (request.headers.get("accept")?.includes("application/json"))
      return NextResponse.json(
        { ...result, redirect: target.toString() },
        {
          status: result.status === "saved" ? 200 : 400,
          headers: { "cache-control": "private, no-store" },
        },
      );
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json(
      { error: "Zahtjev nije dopušten. Provjerite prijavu i ovlasti." },
      { status: 403 },
    );
  }
}
