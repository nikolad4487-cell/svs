import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireIdentity } from "@/lib/auth/access";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
const headers = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};
export async function GET(req: NextRequest) {
  try {
    const { db } = await requireIdentity("issp");
    const inst = z.uuid().parse(req.nextUrl.searchParams.get("institution")),
      student = z.uuid().parse(req.nextUrl.searchParams.get("student"));
    const profile = await db
      .from("issp_profiles")
      .select("photo_path")
      .eq("institution_id", inst)
      .eq("student_id", student)
      .maybeSingle();
    if (profile.error || !profile.data?.photo_path)
      return new NextResponse(null, { status: 404, headers });
    const signed = await db.storage
      .from("issp-photos")
      .createSignedUrl(profile.data.photo_path, 300);
    if (signed.error) throw Error("photo");
    return NextResponse.redirect(signed.data.signedUrl, {
      status: 307,
      headers,
    });
  } catch {
    return new NextResponse(null, { status: 403, headers });
  }
}
export async function POST(req: NextRequest) {
  let uploaded: string | undefined;
  let db: Awaited<ReturnType<typeof requireIdentity>>["db"] | undefined;
  try {
    await assertSameOrigin();
    const account = await requireIdentity("issp");
    db = account.db;
    if (Number(req.headers.get("content-length") || 0) > 2500000)
      return NextResponse.json(
        { error: "Fotografija smije imati najviše 2 MB." },
        { status: 413, headers },
      );
    const form = await req.formData();
    const inst = z.uuid().parse(form.get("institution_id")),
      student = z.uuid().parse(form.get("student_id")),
      expected = z.coerce.number().int().min(0).parse(form.get("revision"));
    const allowed = await db.rpc("issp_student_access", {
      inst,
      student,
      editing: true,
    });
    if (allowed.error || !allowed.data) throw Error("forbidden");
    const file = form.get("photo");
    if (!(file instanceof File) || file.size < 1 || file.size > 2097152)
      throw Error("invalid photo");
    const bytes = Buffer.from(await file.arrayBuffer());
    const valid =
      (file.type === "image/jpeg" &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255) ||
      (file.type === "image/png" &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.type === "image/webp" &&
        bytes.subarray(0, 4).toString() === "RIFF" &&
        bytes.subarray(8, 12).toString() === "WEBP");
    if (!valid) throw Error("invalid photo");
    const normalized = await sharp(bytes, { limitInputPixels: 20000000 })
      .rotate()
      .resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();
    const previous = await db
      .from("issp_profiles")
      .select("photo_path")
      .eq("institution_id", inst)
      .eq("student_id", student)
      .maybeSingle();
    if (previous.error) throw Error("profile");
    uploaded = `${inst}/${student}/${randomUUID()}`;
    const upload = await db.storage
      .from("issp-photos")
      .upload(uploaded, normalized, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (upload.error) throw Error("upload");
    const result = await db.rpc("issp_save_profile", {
      inst,
      student,
      item_phone: z
        .string()
        .trim()
        .max(80)
        .parse(form.get("phone") || ""),
      item_photo: uploaded,
      expected,
    });
    const { url } = await requestContext();
    const target = new URL(url("issp"));
    target.searchParams.set("institution", inst);
    target.searchParams.set("student", student);
    target.searchParams.set("view", "Upravljanje evidencijom");
    const year = z.uuid().safeParse(form.get("academic_year_id"));
    if (year.success) target.searchParams.set("academic_year", year.data);
    if (result.error) {
      await db.storage.from("issp-photos").remove([uploaded]);
      uploaded = undefined;
      target.searchParams.set(
        "status",
        result.error.message.includes("ISSP_CONFLICT") ? "conflict" : "invalid",
      );
      return NextResponse.redirect(target, 303);
    }
    uploaded = undefined;
    if (previous.data?.photo_path)
      await db.storage.from("issp-photos").remove([previous.data.photo_path]);
    target.searchParams.set("status", "saved");
    return NextResponse.redirect(target, 303);
  } catch {
    if (db && uploaded) await db.storage.from("issp-photos").remove([uploaded]);
    return NextResponse.json(
      {
        error:
          "Fotografija nije spremljena. Provjerite ovlasti, veličinu, format i verziju zapisa.",
      },
      { status: 403, headers },
    );
  }
}
