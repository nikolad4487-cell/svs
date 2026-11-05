import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireIdentity } from "@/lib/auth/access";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { supabaseConfig } from "@/lib/supabase/config";
import { emailDomain } from "@/lib/auth/email-domains";
import {
  admissionPreview,
  allRows,
  provisionAdmission,
} from "../../../../../scripts/lib/verified-admissions.mjs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Pragma: "no-cache" };
const mappingSchema = z.object({
  institution_id: z.uuid(),
  program_id: z.uuid(),
  academic_year_id: z.uuid(),
  source_school_id: z.string().min(1).max(200),
  source_program_id: z.uuid(),
  source_year_id: z.uuid(),
  candidate_year_id: z.uuid(),
  domain: emailDomain,
  matura_required: z.boolean(),
  requirements_reference: z.string().trim().min(3).max(500),
  enabled: z.boolean(),
});
function sourceClient() {
  const url = process.env.EMATICA_SUPABASE_URL,
    key = process.env.EMATICA_SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Source configuration missing");
  const u = new URL(url);
  if (
    u.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(u.hostname)
  )
    throw new Error("Source requires HTTPS");
  return {
    source: createClient(u.origin, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    origin: u.origin,
  };
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    await assertSameOrigin();
    const account = await requireIdentity("admin");
    if (!account.superadmin) throw new Error("Forbidden");
    if (Number(req.headers.get("content-length") || 0) > 20000)
      throw new Error("size");
    const { action } = await params;
    const body = await req.json();
    const respond = (data: unknown, status = 200) =>
      NextResponse.json(data, { status, headers });
    if (action === "mapping") {
      const input = mappingSchema.parse(body);
      const result = body.id
        ? await account.db
            .from("admission_import_mappings")
            .update(input)
            .eq("id", z.uuid().parse(body.id))
            .select("id")
        : await account.db
            .from("admission_import_mappings")
            .insert(input)
            .select("id");
      if (result.error || !result.data?.length)
        return respond(
          {
            error:
              "Mapiranje nije spremljeno. Provjerite dopuštenu domenu, jedinstvenu kombinaciju i pripadnost programa/godine ustanovi.",
          },
          400,
        );
      return respond({ saved: true });
    }
    if (action === "review") {
      const input = z
        .object({
          mapping_id: z.uuid(),
          candidate_id: z.uuid(),
          graduation_verified: z.boolean(),
          matura_verified: z.boolean(),
          conditions_verified: z.boolean(),
          evidence_reference: z.string().trim().min(3).max(1000),
        })
        .parse(body);
      const m = await account.db
        .from("admission_import_mappings")
        .select("institution_id")
        .eq("id", input.mapping_id)
        .single();
      if (m.error) throw new Error("mapping");
      const { source } = sourceClient();
      const candidate = await source
        .from("admission_candidates")
        .select("id,registry_student_id,accepted_choice_id")
        .eq("id", input.candidate_id)
        .single();
      if (candidate.error || !candidate.data.accepted_choice_id)
        throw new Error("candidate");
      const r = await account.db.from("admission_import_reviews").upsert(
        {
          ...input,
          source_student_id: candidate.data.registry_student_id,
          source_choice_id: candidate.data.accepted_choice_id,
          institution_id: m.data.institution_id,
        },
        { onConflict: "mapping_id,candidate_id" },
      );
      if (r.error) throw new Error("review");
      return respond({ saved: true });
    }
    const { source, origin } = sourceClient();
    if (action === "catalog") {
      const [
        programs,
        years,
        mappings,
        institutions,
        targetPrograms,
        targetYears,
      ] = await Promise.all([
        (async () => {
          // Shared e-Dnevnik databases may predate the programs→schools FK.
          // Match explicit IDs instead of relying on an embedded relation.
          const schools = await allRows(() =>
            source
              .from("schools")
              .select("id,name")
              .eq("education_level", "HIGHER")
              .order("id"),
          );
          const programmes = [];
          for (let offset = 0; offset < schools.length; offset += 100) {
            const ids = schools.slice(offset, offset + 100).map((s) => s.id);
            const rows = await allRows(() =>
              source
                .from("programs")
                .select("id,name,school_id")
                .in("school_id", ids)
                .order("id"),
            );
            programmes.push(
              ...rows.map((p) => ({
                ...p,
                schools: {
                  name:
                    schools.find((s) => s.id === p.school_id)?.name ||
                    "Učilište",
                },
              })),
            );
          }
          return programmes;
        })(),
        allRows(() =>
          source.from("school_years").select("id,label").order("id"),
        ),
        allRows(() =>
          account.db.from("admission_import_mappings").select("*").order("id"),
        ),
        allRows(() =>
          account.db
            .from("institutions")
            .select("id,name,email_domains")
            .order("id"),
        ),
        allRows(() =>
          account.db
            .from("study_programs")
            .select("id,institution_id,name")
            .order("id"),
        ),
        allRows(() =>
          account.db
            .from("academic_years")
            .select("id,institution_id,name")
            .order("id"),
        ),
      ]);
      return respond({
        programs,
        years,
        mappings,
        institutions,
        targetPrograms,
        targetYears,
      });
    }
    const mapping_id = z.uuid().parse(body.mapping_id);
    const result = await account.db
      .from("admission_import_mappings")
      .select("*")
      .eq("id", mapping_id)
      .single();
    if (result.error) throw new Error("mapping");
    const mapping = result.data;
    const rows = await admissionPreview(source, account.db, mapping);
    if (action === "preview") return respond({ rows });
    if (action === "apply") {
      const ids = z.array(z.uuid()).min(1).max(5).parse(body.candidates);
      if (new Set(ids).size !== ids.length) throw new Error("duplicate");
      const selected = ids.map((id) => rows.find((r) => r.candidate_id === id));
      if (selected.some((r) => !r || !r.eligible))
        return respond(
          {
            error:
              "Podaci su se promijenili ili nisu ispunjeni svi uvjeti. Ponovite pregled.",
          },
          409,
        );
      const config = supabaseConfig(),
        key = process.env.SVS_SUPABASE_SECRET_KEY;
      if (!config || !key)
        return respond(
          { error: "U Vercelu postavite serverski SVS_SUPABASE_SECRET_KEY." },
          503,
        );
      if (
        process.env.SVS_SUPABASE_URL &&
        new URL(process.env.SVS_SUPABASE_URL).origin !==
          new URL(config.url).origin
      )
        throw new Error("Target mismatch");
      if (new URL(config.url).origin === origin)
        throw new Error("Projects must differ");
      const target = createClient(config.url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const ready = await target.rpc("password_change_session_is_active");
      if (ready.error)
        return respond(
          {
            error:
              "Primijenite migraciju za privremene lozinke prije prijenosa.",
          },
          503,
        );
      const institution = await account.db
        .from("institutions")
        .select("name")
        .eq("id", mapping.institution_id)
        .single();
      if (institution.error) throw new Error("institution");
      const results = [];
      for (const row of selected) {
        if (row!.job === "completed") {
          results.push({
            candidate_id: row!.candidate_id,
            status: "already_completed",
          });
          continue;
        }
        try {
          const transferred = await provisionAdmission(
            target,
            account.db,
            mapping,
            row!,
            origin,
            institution.data.name,
          );
          results.push({
            candidate_id: row!.candidate_id,
            status: "completed",
            ...transferred,
          });
        } catch (error) {
          const issued = (
            error as { issued?: { user_id: string; credentials: unknown } }
          ).issued;
          results.push({
            candidate_id: row!.candidate_id,
            status: "failed",
            ...(issued || {}),
            error:
              "Prijenos nije dovršen. Sačuvajte već izdane podatke i ponovite pregled stanja prije novog pokušaja.",
          });
        }
      }
      const { url } = await requestContext();
      return respond({ results, loginUrl: url("auth") });
    }
    return respond({ error: "Nije pronađeno." }, 404);
  } catch {
    return NextResponse.json(
      {
        error:
          "Postupak nije dostupan. Provjerite ovlasti, izvorne serverske varijable i migraciju 202611030001_verified_admissions.sql. Podaci izvornog sustava nisu mijenjani.",
      },
      { status: 403, headers },
    );
  }
}
