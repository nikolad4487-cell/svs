import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/auth/request";
import { requireIdentity } from "@/lib/auth/access";
import {
  fileRequest,
  learningBucket,
  type LearningFile,
} from "@/lib/learning/files";
const headers = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
};
const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    const { db } = await requireIdentity("merlin");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return fail(415, "Neispravan zahtjev.");
    if (Number(request.headers.get("content-length") || 0) > 4096)
      return fail(413, "Prevelik zahtjev.");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) return fail(413, "Prevelik zahtjev.");
    const body = JSON.parse(raw);
    const { action } = await params;
    if (action === "prepare") {
      const f = fileRequest.parse(body);
      const reserved = await db
        .rpc("learning_reserve_file", {
          kind: f.kind,
          target: f.target,
          filename: f.name,
          mimetype: f.type,
          bytes: f.size,
        })
        .single<LearningFile>();
      if (reserved.error)
        return fail(
          400,
          reserved.error.message.includes("LEARNING_FILE_LIMIT")
            ? "Najviše 20 privitaka po materijalu ili zadatku. Uklonite nepotrebne privitke."
            : "Učitavanje nije dostupno. Provjerite ovlasti i je li uključena pohrana privitaka.",
        );
      const file = reserved.data;
      const signed = await db.storage
        .from(learningBucket)
        .createSignedUploadUrl(file.object_path, { upsert: false });
      if (signed.error) {
        await db.rpc("learning_remove_file", { target: file.id });
        return fail(
          503,
          "Pohrana nije dostupna. Pokušajte ponovno ili se obratite administratoru.",
        );
      }
      return NextResponse.json(
        { id: file.id, url: signed.data.signedUrl, type: f.type },
        { headers },
      );
    }
    const id = z.uuid().parse(body.id);
    if (action === "complete") {
      const result = await db.rpc("learning_complete_file", { target: id });
      return result.error
        ? fail(
            400,
            "Datoteka nije potvrđena. Provjerite dovršetak učitavanja i pokušajte ponovno.",
          )
        : NextResponse.json({ ok: true }, { headers });
    }
    if (action === "remove") {
      const file = await db
        .from("learning_files")
        .select("object_path")
        .eq("id", id)
        .single();
      if (file.error) return fail(404, "Privitak nije dostupan.");
      const access = await db.rpc("learning_file_access", {
        target_path: file.data.object_path,
        editing: true,
      });
      if (access.error || !access.data)
        return fail(403, "Nemate ovlasti za uklanjanje privitka.");
      const removed = await db.storage
        .from(learningBucket)
        .remove([file.data.object_path]);
      if (removed.error)
        return fail(503, "Privitak nije uklonjen. Pokušajte ponovno.");
      const result = await db.rpc("learning_remove_file", { target: id });
      return result.error
        ? fail(
            409,
            "Privitak nije uklonjen. Osvježite stranicu i pokušajte ponovno.",
          )
        : NextResponse.json({ ok: true }, { headers });
    }
    return fail(404, "Nepoznata radnja.");
  } catch (error) {
    return fail(
      error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 403,
      "Zahtjev nije ispravan ili nemate ovlasti. Provjerite vrstu i veličinu datoteke.",
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const id = z.uuid().parse((await params).action);
    const { db } = await requireIdentity("merlin");
    const file = await db
      .from("learning_files")
      .select("object_path,file_name,mime_type")
      .eq("id", id)
      .eq("status", "ready")
      .single();
    if (file.error) return fail(404, "Privitak nije dostupan.");
    const inline =
      request.nextUrl.searchParams.get("inline") === "1" &&
      /^(image|video)\//.test(file.data.mime_type);
    const signed = await db.storage
      .from(learningBucket)
      .createSignedUrl(
        file.data.object_path,
        300,
        inline ? undefined : { download: file.data.file_name },
      );
    if (signed.error) return fail(404, "Privitak nije dostupan.");
    return NextResponse.redirect(signed.data.signedUrl, {
      status: 302,
      headers,
    });
  } catch {
    return fail(404, "Privitak nije dostupan.");
  }
}
