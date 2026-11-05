import { loginName } from "./ematica-import.mjs";
import { randomBytes } from "node:crypto";
export async function allRows(query) {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const r = await query().range(offset, offset + 199);
    if (r.error)
      throw new Error("Izvorni podaci nisu dostupni. Provjerite vezu i shemu.");
    rows.push(...r.data);
    if (r.data.length < 200) return rows;
  }
}
export function assessAdmission(
  mapping,
  candidate,
  choice,
  enrollment,
  graduation,
  review,
) {
  const reasons = [];
  if (!mapping.enabled) reasons.push("Mapiranje je isključeno.");
  if (
    !candidate ||
    candidate.track !== "HIGHER_EDUCATION" ||
    candidate.status !== "ACCEPTED" ||
    !candidate.finalized_at
  )
    reasons.push("Kandidatura nije konačno prihvaćena.");
  if (
    !candidate ||
    !choice ||
    candidate.accepted_choice_id !== choice.id ||
    choice.candidate_id !== candidate.id ||
    !choice.is_accepted ||
    choice.target_school_id !== mapping.source_school_id ||
    choice.target_program_id !== mapping.source_program_id
  )
    reasons.push("Nema potvrđenog izbora za ovaj fakultet i program.");
  if (
    !candidate ||
    !enrollment ||
    enrollment.student_id !== candidate.registry_student_id ||
    enrollment.school_id !== mapping.source_school_id ||
    enrollment.program_id !== mapping.source_program_id ||
    enrollment.school_year_id !== mapping.source_year_id ||
    enrollment.status !== "ACTIVE"
  )
    reasons.push("Upis na fakultet još nije proveden.");
  const reviewed = Boolean(
    review &&
      review.mapping_id === mapping.id &&
      review.candidate_id === candidate?.id &&
      review.reviewed_by &&
      review.mapping_revision === mapping.revision &&
      review.source_student_id === candidate?.registry_student_id &&
      review.source_choice_id === candidate?.accepted_choice_id &&
      review.evidence_reference?.trim().length >= 3,
  );
  const schoolProof = Boolean(
    candidate &&
      graduation?.some(
        (g) =>
          g.registry_student_id === candidate.registry_student_id &&
          g.status === "GRADUATED" &&
          g.school_id === candidate.source_school_id,
      ),
  );
  if (!schoolProof && !(reviewed && review.graduation_verified))
    reasons.push("Nedostaje dokaz završetka srednje škole.");
  if (mapping.matura_required && !(reviewed && review.matura_verified))
    reasons.push(
      "Nedostaje provjera položene mature. Prijava ispita nije rezultat.",
    );
  if (!(reviewed && review.conditions_verified))
    reasons.push("Uvjeti programa još nisu provjereni.");
  return { eligible: reasons.length === 0, reasons, schoolProof };
}
export async function admissionPreview(source, target, mapping) {
  const choices = await allRows(() =>
    source
      .from("admission_choices")
      .select("id,candidate_id,target_school_id,target_program_id,is_accepted")
      .eq("target_school_id", mapping.source_school_id)
      .eq("target_program_id", mapping.source_program_id)
      .order("id"),
  );
  const candidates = [];
  for (let i = 0; i < choices.length; i += 100) {
    const ids = choices.slice(i, i + 100).map((c) => c.candidate_id);
    candidates.push(
      ...(await allRows(() =>
        source
          .from("admission_candidates")
          .select(
            "id,registry_student_id,source_school_id,school_year_id,accepted_choice_id,status,track,finalized_at,registry_students!inner(id,first_name,last_name)",
          )
          .in("id", ids)
          .eq("track", "HIGHER_EDUCATION")
          .eq("school_year_id", mapping.candidate_year_id)
          .order("id"),
      )),
    );
  }
  const enrollments = await allRows(() =>
    source
      .from("student_school_enrollments")
      .select("id,student_id,school_id,program_id,school_year_id,status")
      .eq("school_id", mapping.source_school_id)
      .eq("program_id", mapping.source_program_id)
      .eq("school_year_id", mapping.source_year_id)
      .eq("status", "ACTIVE")
      .order("id"),
  );
  const graduates = [];
  for (let i = 0; i < candidates.length; i += 100) {
    const ids = candidates.slice(i, i + 100).map((c) => c.registry_student_id);
    graduates.push(
      ...(await allRows(() =>
        source
          .from("student_year_end_summaries")
          .select("id,registry_student_id,school_id,status")
          .in("registry_student_id", ids)
          .eq("status", "GRADUATED")
          .order("id"),
      )),
    );
  }
  const reviews = await allRows(() =>
    target
      .from("admission_import_reviews")
      .select("*")
      .eq("mapping_id", mapping.id)
      .order("id"),
  );
  const jobs = await allRows(() =>
    target
      .from("admission_import_jobs")
      .select("id,candidate_id,state")
      .eq("mapping_id", mapping.id)
      .order("id"),
  );
  return [...new Map(candidates.map((c) => [c.id, c])).values()].map((c) => {
    const choice = choices.find((x) => x.id === c.accepted_choice_id),
      enrollment = enrollments.find(
        (e) => e.student_id === c.registry_student_id,
      );
    const review = reviews.find((r) => r.candidate_id === c.id);
    return {
      candidate_id: c.id,
      student_id: c.registry_student_id,
      full_name:
        `${c.registry_students.first_name} ${c.registry_students.last_name}`
          .trim()
          .slice(0, 200),
      ...assessAdmission(mapping, c, choice, enrollment, graduates, review),
      review: review || null,
      job: jobs.find((j) => j.candidate_id === c.id)?.state || null,
    };
  });
}
export async function provisionAdmission(
  target,
  claimClient,
  mapping,
  row,
  sourceOrigin,
  institutionName,
  onCredential,
) {
  if (!row.eligible) throw new Error("Kandidat ne ispunjava uvjete.");
  const claim = await claimClient.rpc("claim_admission_import", {
    mapping: mapping.id,
    candidate: row.candidate_id,
  });
  if (claim.error || !claim.data)
    throw new Error(
      "Prijenos je već pokrenut ili dovršen. Ne ponavljajte paralelno.",
    );
  let issued = null;
  const job = claim.data,
    key = `${sourceOrigin}:${row.student_id}:${mapping.institution_id}`;
  try {
    const institution = await target
      .from("institutions")
      .select("active,email_domains")
      .eq("id", mapping.institution_id)
      .single();
    if (
      institution.error ||
      !institution.data.active ||
      !institution.data.email_domains.includes(mapping.domain)
    )
      throw new Error("Domena ustanove više nije dopuštena.");
    const email = loginName(
      row.full_name.split(" ")[0],
      row.full_name.split(" ").slice(1).join(" "),
      row.student_id,
      mapping.domain,
    );
    let user = null;
    for (let page = 1; ; page++) {
      const r = await target.auth.admin.listUsers({ page, perPage: 500 });
      if (r.error) throw new Error("Auth provjera nije dostupna.");
      for (const u of r.data.users) {
        if (u.app_metadata?.ematica_import_key === key) {
          if (user && user.id !== u.id)
            throw new Error("Duplicirana veza računa.");
          user = u;
        } else if (u.email?.toLowerCase() === email)
          throw new Error("Korisničko ime pripada nepovezanom računu.");
      }
      if (r.data.users.length < 500) break;
    }
    let credentials = null;
    if (!user) {
      const password = randomBytes(24).toString("base64url");
      const pending = await target
        .from("registration_invites")
        .select("id")
        .eq("institution_id", mapping.institution_id)
        .eq("email", email)
        .eq("role", "student")
        .is("accepted_at", null)
        .maybeSingle();
      if (pending.error) throw new Error("Provjera poziva nije uspjela.");
      const inv = pending.data
        ? await target
            .from("registration_invites")
            .update({
              expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            })
            .eq("id", pending.data.id)
        : await target
            .from("registration_invites")
            .insert({
              institution_id: mapping.institution_id,
              email,
              role: "student",
            });
      if (inv.error) throw new Error("Poziv nije spremljen.");
      if (onCredential)
        await onCredential({
          status: "candidate",
          email,
          password,
          full_name: row.full_name,
          institution: institutionName,
        });
      const result = await target.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: row.full_name },
        app_metadata: {
          ematica_import_key: key,
          svs_password_change_required: true,
        },
      });
      if (result.error || !result.data.user)
        throw new Error(
          "Izrada računa nije potvrđena. Ponovite pregled stanja.",
        );
      user = result.data.user;
      credentials = {
        email,
        password,
        full_name: row.full_name,
        institution: institutionName,
      };
      issued = { user_id: user.id, credentials };
      if (onCredential)
        await onCredential({ status: "created", email, user_id: user.id });
    }
    const tracking = await target
      .from("admission_import_jobs")
      .update({ user_id: user.id })
      .eq("id", job);
    if (tracking.error) throw new Error("Praćenje računa nije spremljeno.");
    const member = await target
      .from("memberships")
      .upsert({
        institution_id: mapping.institution_id,
        user_id: user.id,
        role: "student",
      });
    if (member.error) throw new Error("Članstvo nije spremljeno.");
    const study = await target
      .from("student_studies")
      .upsert(
        {
          institution_id: mapping.institution_id,
          student_id: user.id,
          program_id: mapping.program_id,
          academic_year_id: mapping.academic_year_id,
          study_year: 1,
          student_number: `EM-${row.student_id.replaceAll("-", "")}`,
          status: "active",
        },
        {
          onConflict: "institution_id,student_id,program_id,academic_year_id",
          ignoreDuplicates: true,
        },
      );
    if (study.error) throw new Error("Upis nije spremljen.");
    const saved = await target
      .from("student_studies")
      .select("id")
      .eq("institution_id", mapping.institution_id)
      .eq("student_id", user.id)
      .eq("program_id", mapping.program_id)
      .eq("academic_year_id", mapping.academic_year_id)
      .single();
    if (saved.error) throw new Error("Upis nije potvrđen.");
    const done = await target
      .from("admission_import_jobs")
      .update({
        state: "completed",
        study_id: saved.data.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job);
    if (done.error) throw new Error("Završetak prijenosa nije potvrđen.");
    return { user_id: user.id, study_id: saved.data.id, credentials };
  } catch (error) {
    if (issued) error.issued = issued;
    await target
      .from("admission_import_jobs")
      .update({ state: "failed", updated_at: new Date().toISOString() })
      .eq("id", job);
    throw error;
  }
}
