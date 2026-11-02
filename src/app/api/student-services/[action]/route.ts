import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireIdentity } from "@/lib/auth/access";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import {
  personalSchema,
  preferencesSchema,
  serviceSchemas,
  type ServiceKind,
} from "@/lib/academic/student-services";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    const account = await requireIdentity();
    if (Number(req.headers.get("content-length") || 0) > 24000)
      throw new Error("size");
    const form = await req.formData(),
      { action } = await params;
    const institution_id = z.uuid().parse(form.get("institution_id"));
    const academic_year_id = z.uuid().parse(form.get("academic_year_id"));
    const manager =
      account.superadmin ||
      account.memberships.some(
        (m) =>
          m.institution_id === institution_id &&
          ["institution_admin", "registrar"].includes(m.role),
      );
    let error;
    if (action === "save" || action === "delete") {
      if (!manager) throw new Error("forbidden");
      if (action === "delete") {
        const result = await account.db
          .from("student_services")
          .delete()
          .eq("id", z.uuid().parse(form.get("id")))
          .eq("institution_id", institution_id)
          .select("id");
        if (!result.data?.length) throw new Error("not found");
        error = result.error;
      } else {
        const kind = z
          .enum([
            "dining",
            "extra_ects",
            "tuition",
            "participation",
            "mobility",
            "category",
            "attendance",
            "certificate",
          ])
          .parse(form.get("kind"));
        const payload = serviceSchemas[kind as ServiceKind].parse(
          Object.fromEntries(form),
        );
        const student_id = z.uuid().parse(form.get("student_id"));
        if (kind === "attendance") {
          const course = await account.db
            .from("course_enrollments")
            .select("id")
            .eq("institution_id", institution_id)
            .eq("student_id", student_id)
            .eq("course_id", form.get("course_id"))
            .limit(1);
          if (!course.data?.length) throw new Error("not enrolled");
        }
        const row = {
          institution_id,
          academic_year_id,
          student_id,
          kind,
          payload,
        };
        const result = form.get("id")
          ? await account.db
              .from("student_services")
              .update(row)
              .eq("id", z.uuid().parse(form.get("id")))
              .eq("institution_id", institution_id)
              .select("id")
          : await account.db.from("student_services").insert(row).select("id");
        error = result.error;
        if (!error && !result.data?.length) throw new Error("forbidden");
      }
    } else if (action === "personal" || action === "preferences") {
      const key = {
        institution_id,
        academic_year_id,
        student_id: account.user.id,
      };
      const existing = await account.db
        .from("student_reports")
        .select("id")
        .match(key)
        .maybeSingle();
      if (existing.error) throw new Error("migration");
      const change =
        action === "personal"
          ? { personal: personalSchema.parse(Object.fromEntries(form)) }
          : {
              preferences: preferencesSchema.parse({
                contact_email: form.get("contact_email"),
                exam_registration: form.has("exam_registration"),
                exam_withdrawal: form.has("exam_withdrawal"),
                announcements: form.has("announcements"),
              }),
            };
      const result = existing.data
        ? await account.db
            .from("student_reports")
            .update(change)
            .eq("id", existing.data.id)
            .select("id")
        : await account.db
            .from("student_reports")
            .insert({ ...key, ...change })
            .select("id");
      error = result.error;
      if (!error && !result.data?.length) throw new Error("forbidden");
    } else throw new Error("action");
    const { url } = await requestContext();
    const target = new URL(
      url(
        action === "save" || action === "delete"
          ? form.get("return_module") === "admin"
            ? "admin"
            : "isvu"
          : "studomat",
      ),
    );
    target.searchParams.set("institution", institution_id);
    target.searchParams.set(
      "view",
      String(form.get("return_view") || "Osobni podaci").slice(0, 80),
    );
    target.searchParams.set("status", error ? "academic-error" : "saved");
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json(
      {
        error:
          "Podaci nisu spremljeni. Provjerite ovlasti, godinu, studenta i unesene vrijednosti.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
