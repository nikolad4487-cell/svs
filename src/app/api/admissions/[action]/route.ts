import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireIdentity } from "@/lib/auth/access";
import { assertSameOrigin, requestContext } from "@/lib/auth/request";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  sourceConfiguration,
  AdmissionConfigurationError,
} from "@/lib/admissions/config";
import { emailDomain } from "@/lib/auth/email-domains";
import {
  AdmissionReadError,
  admissionPreview,
  allRows,
  provisionAdmission,
} from "../../../../../scripts/lib/verified-admissions.mjs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Pragma: "no-cache" };
const firstMappingSchema = z.object({
  institution_id: z.uuid(),
  program_id: z.uuid(),
  academic_year_id: z.uuid(),
  domain: emailDomain,
  matura_required: z.boolean(),
  requirements_reference: z.string().trim().min(3).max(500),
  enabled: z.boolean().default(true),
});
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
async function allFinished<T extends readonly unknown[]>(
  tasks: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  // Finish independent reads before returning an error; no source request outlives this catalogue response.
  await Promise.allSettled(tasks);
  return Promise.all(tasks);
}
function sourceClient() {
  const config = sourceConfiguration(process.env);
  return {
    source: createClient(config.origin, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    origin: config.origin,
  };
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  let authorized = false;
  try {
    await assertSameOrigin();
    const account = await requireIdentity("referada");
    const staffIds = [
      ...new Set(
        account.memberships
          .filter((m) => ["institution_admin", "registrar"].includes(m.role))
          .map((m) => m.institution_id),
      ),
    ];
    if (!account.superadmin && !staffIds.length) throw new Error("Forbidden");
    const staffScope = account.superadmin
      ? "id.not.is.null"
      : `institution_id.in.(${staffIds.join(",")})`;
    const institutionScope = account.superadmin
      ? "id.not.is.null"
      : `id.in.(${staffIds.join(",")})`;
    authorized = true;
    if (Number(req.headers.get("content-length") || 0) > 20000)
      throw new Error("size");
    const { action } = await params;
    const body = await req.json();
    const respond = (data: unknown, status = 200) =>
      NextResponse.json(data, { status, headers });
    if (action === "target-catalog") {
      const [mappings, institutions, targetPrograms, targetYears] =
        await allFinished([
          allRows(
            () =>
              account.db
                .from("admission_import_mappings")
                .select("*")
                .or(staffScope)
                .eq("mode", "first")
                .order("id"),
            "ISVU: upisni postupci",
            "target",
          ),
          allRows(
            () =>
              account.db
                .from("institutions")
                .select("id,name,email_domains")
                .or(institutionScope)
                .order("id"),
            "ISVU: učilišta",
            "target",
          ),
          allRows(
            () =>
              account.db
                .from("study_programs")
                .select("id,institution_id,name")
                .or(staffScope)
                .order("id"),
            "ISVU: programi",
            "target",
          ),
          allRows(
            () =>
              account.db
                .from("academic_years")
                .select("id,institution_id,name")
                .or(staffScope)
                .order("id"),
            "ISVU: godine",
            "target",
          ),
        ]);
      return respond({ mappings, institutions, targetPrograms, targetYears });
    }
    if (action === "first-mapping") {
      const input = {
        ...firstMappingSchema.parse(body),
        mode: "first",
        source_school_id: null,
        source_program_id: null,
        source_year_id: null,
        candidate_year_id: null,
      };
      const result = body.id
        ? await account.db
            .from("admission_import_mappings")
            .update(input)
            .eq("id", z.uuid().parse(body.id))
            .eq("mode", "first")
            .select("id")
        : await account.db
            .from("admission_import_mappings")
            .insert(input)
            .select("id");
      if (result.error || !result.data?.length)
        return respond(
          {
            error:
              "Upisni postupak nije spremljen. Provjerite pripadnost programa/godine učilištu, dopuštenu domenu i postoji li već postupak za taj studij i godinu. Potrebna je migracija 202611060001_first_enrollment.sql.",
          },
          400,
        );
      return respond({ saved: true, id: result.data[0].id });
    }
    if (action === "mapping") {
      const input = mappingSchema.parse(body);
      const result = body.id
        ? await account.db
            .from("admission_import_mappings")
            .update(input)
            .eq("id", z.uuid().parse(body.id))
            .eq("mode", "recorded")
            .select("id")
        : await account.db
            .from("admission_import_mappings")
            .insert({ ...input, mode: "recorded" })
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
          admission_approved: z.boolean().default(false),
        })
        .parse(body);
      const m = await account.db
        .from("admission_import_mappings")
        .select("*")
        .eq("id", input.mapping_id)
        .single();
      if (m.error) throw new Error("mapping");
      const { source } = sourceClient();
      let sourceStudentId: string, sourceChoiceId: string | null;
      if (m.data.mode === "first") {
        const ready = await admissionPreview(source, account.db, m.data);
        const student = ready.find(
          (r) => r.candidate_id === input.candidate_id,
        );
        if (!student?.schoolProof)
          return respond(
            {
              error:
                "Završetak srednje škole za tog učenika još nije evidentiran u e-Matici.",
            },
            409,
          );
        sourceStudentId = student.student_id;
        sourceChoiceId = null;
      } else {
        const candidate = await source
          .from("admission_candidates")
          .select("id,registry_student_id,accepted_choice_id")
          .eq("id", input.candidate_id)
          .single();
        if (candidate.error || !candidate.data.accepted_choice_id)
          throw new Error("candidate");
        sourceStudentId = candidate.data.registry_student_id;
        sourceChoiceId = candidate.data.accepted_choice_id;
      }
      const r = await account.db.from("admission_import_reviews").upsert(
        {
          ...input,
          source_student_id: sourceStudentId,
          source_choice_id: sourceChoiceId,
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
      ] = await allFinished([
        (async () => {
          // Shared e-Dnevnik databases may predate the programs→schools FK.
          // Match explicit IDs instead of relying on an embedded relation.
          const schools = await allRows(
            () =>
              source
                .from("schools")
                .select("id,name")
                .eq("education_level", "HIGHER")
                .order("id"),
            "e-Matica: visoka učilišta",
          );
          const programmes = [];
          for (let offset = 0; offset < schools.length; offset += 100) {
            const ids = schools.slice(offset, offset + 100).map((s) => s.id);
            const rows = await allRows(
              () =>
                source
                  .from("programs")
                  .select("id,name,school_id")
                  .in("school_id", ids)
                  .order("id"),
              "e-Matica: studijski programi",
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
        allRows(
          () => source.from("school_years").select("id,label").order("id"),
          "e-Matica: školske godine",
        ),
        allRows(
          () =>
            account.db
              .from("admission_import_mappings")
              .select("*")
              .or(staffScope)
              .eq("mode", "recorded")
              .order("id"),
          "SVS: mapiranja upisa",
          "target",
        ),
        allRows(
          () =>
            account.db
              .from("institutions")
              .select("id,name,email_domains")
              .or(institutionScope)
              .order("id"),
          "SVS: ustanove",
          "target",
        ),
        allRows(
          () =>
            account.db
              .from("study_programs")
              .select("id,institution_id,name")
              .or(staffScope)
              .order("id"),
          "SVS: studijski programi",
          "target",
        ),
        allRows(
          () =>
            account.db
              .from("academic_years")
              .select("id,institution_id,name")
              .or(staffScope)
              .order("id"),
          "SVS: akademske godine",
          "target",
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
  } catch (error) {
    let status = 503;
    let message =
      "Dohvat nije uspio. Provjerite serversku konfiguraciju izvora u Vercelu i pokušajte ponovno. Izvorni podaci nisu mijenjani.";
    if (!authorized) {
      status = 403;
      message =
        "Za ovaj postupak potrebna je prijava referade ili administratora ustanove.";
    } else if (
      error instanceof AdmissionConfigurationError ||
      error instanceof AdmissionReadError
    )
      message = error.message;
    else if (error instanceof z.ZodError || error instanceof SyntaxError) {
      status = 400;
      message = "Zahtjev nije ispravan. Provjerite unesene vrijednosti.";
    }
    return NextResponse.json({ error: message }, { status, headers });
  }
}
