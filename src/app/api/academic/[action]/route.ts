import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { academicMutation } from "@/lib/academic/service";
import { safeModule } from "@/lib/auth/policy";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    if (Number(request.headers.get("content-length") || 0) > 32768)
      return NextResponse.json({ error: "Prevelik obrazac." }, { status: 413 });
    const form = await request.formData();
    const { action } = await params;
    const error = await academicMutation(action, form);
    const { url } = await requestContext();
    const module = safeModule(form.get("return_module"));
    const target = new URL(url(module));
    target.searchParams.set("institution", String(form.get("institution_id")));
    const view = form.get("return_view");
    if (typeof view === "string" && view.length <= 80)
      target.searchParams.set("view", view);
    target.searchParams.set("status", error ? "academic-error" : "saved");
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json(
      {
        error:
          "Obrazac nije ispravan ili nemate ovlasti. Podaci nisu promijenjeni.",
      },
      { status: 403 },
    );
  }
}
