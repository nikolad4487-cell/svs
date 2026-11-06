import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { registrarMutation } from "@/lib/academic/registrar-service";
import { registrarError } from "@/lib/academic/registrar";
import { workflowErrorStatus } from "@/lib/academic/exam-workflow";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    if (Number(req.headers.get("content-length") || 0) > 30000)
      return NextResponse.json({ error: "Prevelik obrazac." }, { status: 413 });
    const form = await req.formData(),
      { action } = await params;
    const error = await registrarMutation(action, form);
    const { url } = await requestContext();
    const target = new URL(url("referada"));
    target.searchParams.set("institution", String(form.get("institution_id")));
    const view = String(form.get("return_view") || "Pregled");
    if (view.length <= 80) target.searchParams.set("view", view);
    const student = form.get("return_student");
    if (typeof student === "string" && /^[a-f0-9-]{36}$/i.test(student))
      target.searchParams.set("student", student);
    target.searchParams.set(
      "status",
      error
        ? registrarError(error.code, error.message) === "academic-error"
          ? workflowErrorStatus(error.message)
          : registrarError(error.code, error.message)
        : "saved",
    );
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json(
      {
        error:
          "Obrazac nije ispravan ili nemate ovlasti za odabranu ustanovu. Promjena nije provedena.",
      },
      { status: 403 },
    );
  }
}
