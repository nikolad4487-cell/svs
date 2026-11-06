import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessAdmission,
  assessFirstEnrollment,
} from "../scripts/lib/verified-admissions.mjs";
const mapping = {
  id: "m",
  enabled: true,
  source_school_id: "college",
  source_program_id: "program",
  source_year_id: "year",
  matura_required: true,
  revision: 1,
};
const candidate = {
  id: "candidate",
  track: "HIGHER_EDUCATION",
  status: "ACCEPTED",
  finalized_at: "2026-11-03",
  registry_student_id: "student",
  accepted_choice_id: "choice",
  source_school_id: "secondary",
};
const choice = {
  id: "choice",
  candidate_id: "candidate",
  target_school_id: "college",
  target_program_id: "program",
  is_accepted: true,
};
const enrollment = {
  student_id: "student",
  school_id: "college",
  program_id: "program",
  school_year_id: "year",
  status: "ACTIVE",
};
const review = {
  mapping_id: "m",
  candidate_id: "candidate",
  reviewed_by: "admin",
  mapping_revision: 1,
  source_student_id: "student",
  source_choice_id: "choice",
  evidence_reference: "Evidence-1",
  matura_verified: true,
  conditions_verified: true,
  graduation_verified: true,
};
test("admissions require the accepted choice, performed enrollment and recorded programme checks", () => {
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], review)
      .eligible,
    true,
  );
  for (const bad of [
    { ...candidate, status: "SUBMITTED" },
    { ...candidate, track: "SECONDARY" },
    { ...candidate, finalized_at: null },
  ])
    assert.equal(
      assessAdmission(mapping, bad, choice, enrollment, [], review).eligible,
      false,
    );
  assert.equal(
    assessAdmission(
      mapping,
      candidate,
      { ...choice, is_accepted: false },
      enrollment,
      [],
      review,
    ).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, null, [], review).eligible,
    false,
  );
  assert.equal(
    assessAdmission(
      mapping,
      candidate,
      choice,
      { ...enrollment, school_id: "other" },
      [],
      review,
    ).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], null).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], {
      ...review,
      matura_verified: false,
    }).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], {
      ...review,
      conditions_verified: false,
    }).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], {
      ...review,
      evidence_reference: "",
    }).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], {
      ...review,
      candidate_id: "different",
    }).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], {
      ...review,
      mapping_revision: 0,
    }).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], {
      ...review,
      source_student_id: "other",
    }).eligible,
    false,
  );
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], {
      ...review,
      source_choice_id: "other",
    }).eligible,
    false,
  );
});
test("graduation proof is scoped to the source pupil and school; matura exemptions are explicit", () => {
  const noSchool = { ...review, graduation_verified: false };
  assert.equal(
    assessAdmission(mapping, candidate, choice, enrollment, [], noSchool)
      .eligible,
    false,
  );
  assert.equal(
    assessAdmission(
      mapping,
      candidate,
      choice,
      enrollment,
      [
        {
          registry_student_id: "student",
          school_id: "secondary",
          status: "GRADUATED",
        },
      ],
      noSchool,
    ).eligible,
    true,
  );
  assert.equal(
    assessAdmission(
      mapping,
      candidate,
      choice,
      enrollment,
      [
        {
          registry_student_id: "other",
          school_id: "secondary",
          status: "GRADUATED",
        },
      ],
      noSchool,
    ).eligible,
    false,
  );
  assert.equal(
    assessAdmission(
      { ...mapping, matura_required: false },
      candidate,
      choice,
      enrollment,
      [],
      { ...review, matura_verified: false },
    ).eligible,
    true,
  );
});

test("first enrollment does not require a source university or prior university enrollment", () => {
  const mapping = {
    id: "first",
    mode: "first",
    revision: 1,
    enabled: true,
    matura_required: true,
    source_school_id: null,
    source_program_id: null,
    source_year_id: null,
    candidate_year_id: null,
  };
  const student = { id: "pupil", graduated: true };
  const review = {
    mapping_id: "first",
    candidate_id: "pupil",
    source_student_id: "pupil",
    source_choice_id: null,
    mapping_revision: 1,
    reviewed_by: "admin",
    evidence_reference: "UPIS-1",
    matura_verified: true,
    conditions_verified: true,
    admission_approved: true,
  };
  assert.equal(assessFirstEnrollment(mapping, student, review).eligible, true);
  assert.equal(
    assessFirstEnrollment(mapping, { ...student, graduated: false }, review)
      .eligible,
    false,
  );
  assert.equal(
    assessFirstEnrollment(mapping, student, {
      ...review,
      admission_approved: false,
    }).eligible,
    false,
  );
  assert.equal(
    assessFirstEnrollment(mapping, student, {
      ...review,
      matura_verified: false,
    }).eligible,
    false,
  );
  assert.equal(
    assessFirstEnrollment(mapping, student, {
      ...review,
      source_student_id: "other",
    }).eligible,
    false,
  );
  assert.equal(
    assessFirstEnrollment(mapping, student, { ...review, mapping_revision: 0 })
      .eligible,
    false,
  );
});
