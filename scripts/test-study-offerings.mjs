import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {localConfig} from './local-config.mjs';
const c=localConfig();assert.ok(['localhost','127.0.0.1'].includes(new URL(c.API_URL).hostname));
const read=f=>JSON.parse(readFileSync('data/study-programs/'+f));
const institutions=read('new-institutions.json'),programs=read('programs-2024.json'),users=JSON.parse(readFileSync('.local-test-users.json'));
const client=key=>createClient(c.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const service=client(c.SERVICE_ROLE_KEY),student=client(c.ANON_KEY),admin=client(c.ANON_KEY),anon=client(c.ANON_KEY);
const ok=async p=>{const r=await p;assert.ifError(r.error);return r.data;};
const sql=text=>execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',c.DB_CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const payload={institution_rows:institutions,program_rows:programs};
const readPrograms=()=>ok(service.from('study_programs').select('id,institution_id,name,code,degree,duration_years,catalog_source_key').like('catalog_source_key','pdf-admissions-2024:program:%').order('id'));
let count=0;const check=async(name,fn)=>{await fn();console.log('PASS '+name);count++;};
const added=[];
try{
 await check('all 706 programme records and 54 missing institutions import once without changing existing IDs',async()=>{
  const before=await readPrograms();assert.equal(before.length,706);
  const result=await ok(service.rpc('import_study_offerings_2024',payload));assert.equal(result.added_institutions,0);assert.equal(result.added_programs,0);
  assert.deepEqual(await readPrograms(),before);
  const rows=await ok(service.from('institutions').select('registry_key').like('registry_key','pdf-admissions-2024:institution:%'));assert.equal(rows.length,54);
 });
 await check('existing UFZG programme, manually configured duration and student-study link survive matching by institution and name',async()=>{
  const target=programs.find(p=>p.institution_key==='hr-isvu-125:102'&&p.name==='Učiteljski studij');
  const year=randomUUID(),study=randomUUID(),manualId=randomUUID();
  const result=sql(`begin;
   update public.study_programs set id='${manualId}',catalog_source_key=null,catalog_source='{}',degree='Integrirani',duration_years=5,code='MANUAL-UFZG' where catalog_source_key='${target.catalog_source_key}';
   insert into public.memberships(institution_id,user_id,role) select institution_id,'${users.student.id}','student' from public.study_programs where id='${manualId}' on conflict do nothing;
   insert into public.academic_years(id,institution_id,name,starts_on,ends_on) select '${year}',institution_id,'Source-test-${year.slice(0,6)}','2026-01-01','2027-12-31' from public.study_programs where id='${manualId}';
   insert into public.student_studies(id,institution_id,student_id,program_id,academic_year_id,study_year,student_number,status) select '${study}',institution_id,'${users.student.id}',id,'${year}',1,'TEST-SOURCE-${year.slice(0,6)}','active' from public.study_programs where id='${manualId}';
   select public.import_study_offerings_2024('[]'::jsonb,$programs$${JSON.stringify([target])}$programs$::jsonb);
   do $test$ begin
    if not exists(select 1 from public.study_programs where id='${manualId}' and catalog_source_key='${target.catalog_source_key}' and degree='Integrirani' and duration_years=5 and code='MANUAL-UFZG') then raise exception 'Existing programme metadata overwritten';end if;
    if exists(select 1 from public.study_programs where id='${target.id}') then raise exception 'Duplicate programme created';end if;
    if not exists(select 1 from public.student_studies where id='${study}' and program_id='${manualId}') then raise exception 'Existing student-study link lost';end if;
   end $test$;rollback;`);
  assert.ok(result.includes('ROLLBACK'));
 });
 await check('programme metadata must be configured before enrollment; configuring it permits normal registrar data',async()=>{
  const p=programs.find(p=>p.institution_key==='hr-isvu-125:117');const year=randomUUID(),study=randomUUID();
  sql(`begin;
   insert into public.memberships(institution_id,user_id,role) select institution_id,'${users.student.id}','student' from public.study_programs where id='${p.id}' on conflict do nothing;
   insert into public.academic_years(id,institution_id,name,starts_on,ends_on) select '${year}',institution_id,'Source-test-${year.slice(0,6)}','2026-01-01','2027-12-31' from public.study_programs where id='${p.id}';
   do $test$ begin
    begin
     insert into public.student_studies(id,institution_id,student_id,program_id,academic_year_id,study_year,student_number,status) select '${study}',institution_id,'${users.student.id}',id,'${year}',1,'TEST-SOURCE-${year.slice(0,6)}','active' from public.study_programs where id='${p.id}';
     raise exception 'Unconfigured programme enrollment was accepted';
    exception when raise_exception then if SQLERRM<>'REGISTRAR_PROGRAM' then raise;end if;end;
   end $test$;
   update public.study_programs set degree='Stručni',duration_years=3 where id='${p.id}';
   insert into public.student_studies(id,institution_id,student_id,program_id,academic_year_id,study_year,student_number,status) select '${study}',institution_id,'${users.student.id}',id,'${year}',1,'TEST-SOURCE-${year.slice(0,6)}','active' from public.study_programs where id='${p.id}';
   rollback;`);
 });
 await check('physical institution addresses do not shadow email-domain validation',async()=>{
  const f=JSON.parse(readFileSync('.local-academic.json'));
  sql(`begin;
   update public.institutions set address='Testna ulica 10' where id='${f.a}';
   do $test$ begin
    if not public.institution_email_allowed('${f.a}','catalog-test@example.test') then raise exception 'Physical address shadows email';end if;
    if public.institution_email_allowed('${f.a}','catalog-test@wrong.example') then raise exception 'Foreign domain allowed';end if;
   end $test$;rollback;`);
 });
 await check('source import rejects missing institution references and rolls back newly inserted institutions',async()=>{
  const key='pdf-admissions-2024:institution:'+randomUUID().replaceAll('-','').slice(0,16);
  const institution={...institutions[0],id:randomUUID(),registry_key:key,subdomain:'source-'+randomUUID().slice(0,8),code:'TEST-'+randomUUID().slice(0,8),parent_registry_key:null};
  const broken={...programs[0],id:randomUUID(),catalog_source_key:'pdf-admissions-2024:program:'+randomUUID().replaceAll('-','').slice(0,24),institution_key:'missing-source-institution'};
  const result=await service.rpc('import_study_offerings_2024',{institution_rows:[institution],program_rows:[broken]});assert.ok(result.error);
  assert.deepEqual(await ok(service.from('institutions').select('id').eq('registry_key',key)),[]);
 });
 for(const [db,role] of [[student,'student'],[admin,'admin']])await ok(db.auth.signInWithPassword({email:users[role].email,password:users[role].password}));
 await check('anonymous and institution-only accounts cannot run the global source import',async()=>{
  for(const db of [anon,student,admin])assert.ok((await db.rpc('import_study_offerings_2024',payload)).error);
 });
 await check('new programmes retain institutional RLS and cannot be read by changing the institution filter',async()=>{
  const fer=await ok(service.from('institutions').select('id').eq('registry_key','hr-isvu-125:016').single());
  const vuka=await ok(service.from('institutions').select('id').eq('registry_key','hr-isvu-125:117').single());
  const membership={institution_id:fer.id,user_id:users.student.id,role:'student'};await ok(service.from('memberships').insert(membership));added.push(membership);
  assert.equal((await ok(student.from('study_programs').select('id').eq('institution_id',fer.id).like('catalog_source_key','pdf-admissions-2024:program:%'))).length,8);
  assert.deepEqual(await ok(student.from('study_programs').select('id').eq('institution_id',vuka.id)),[]);
 });
 console.log(`${count} study-offering scenarios passed.`);
}finally{for(const membership of added)await ok(service.from('memberships').delete().match(membership));}
