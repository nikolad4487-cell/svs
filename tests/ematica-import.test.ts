import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginName, planImport } from '../scripts/lib/ematica-import.mjs';
const m = {school_id:'college',program_id:'p',school_year_id:'y',institution_id:'i',svs_program_id:'sp',academic_year_id:'ay',domain:'college.example'};
const e = {school_id:'college',program_id:'p',school_year_id:'y',status:'ACTIVE',schools:{education_level:'HIGHER'},registry_students:{id:'student-1',first_name:'Đuro',last_name:'Čović'}};
test('import uses active higher education enrollments and explicit mappings',()=>{
  assert.equal(planImport([{...e,status:'EXITED'}, {...e,schools:{education_level:'SECONDARY'}}],[m],'source').length,0);
  const p=planImport([e],[m],'source')[0];
  assert.match(p.email,/^djuro.covic\.[a-f0-9]{12}@college.example$/);
  assert.equal(p.email,loginName('Đuro','Čović','student-1','college.example'));
  assert.notEqual(p.email,loginName('Đuro','Čović','student-2','college.example'));
  assert.throws(()=>planImport([e],[],'source'));
  assert.throws(()=>planImport([e],[m,m],'source'));
  assert.throws(()=>planImport([e,e],[m],'source'));
});
