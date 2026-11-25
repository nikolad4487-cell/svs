import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{randomUUID}from'node:crypto';import{spawn}from'node:child_process';import{createClient}from'@supabase/supabase-js';import{localConfig}from'./local-config.mjs';
const c=localConfig();assert.ok(['localhost','127.0.0.1'].includes(new URL(c.API_URL).hostname));const f=JSON.parse(readFileSync('.local-academic.json')),users=JSON.parse(readFileSync('.local-test-users.json'));
const client=k=>createClient(c.API_URL,k||c.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),service=client(c.SERVICE_ROLE_KEY),db={};const ok=async p=>{const r=await p;assert.ifError(r.error);return r.data;};const deny=async(p,part)=>{const r=await p;assert.ok(r.error);if(part)assert.ok(r.error.message.includes(part),r.error.message);};
const terms=[],tag=randomUUID().slice(0,8);let membership=false,study,enrollment,server,count=0;
const check=async(n,fn)=>{await fn();console.log('PASS '+n);count++;};
const args={target:null,inst:f.a,course:f.courseA,label:'Kolokvij '+tag,starts:new Date(Date.now()+10*86400000).toISOString(),registration_end:new Date(Date.now()+9*86400000).toISOString(),withdrawal_end:new Date(Date.now()+9*86400000).toISOString(),seats:1};
const origin='http://localhost:3021';const req=(path,body,cookie='',extra={})=>fetch(origin+path,{method:body?'POST':'GET',redirect:'manual',headers:{cookie,...(body?{origin,'content-type':'application/x-www-form-urlencoded'}:{}),...extra},...(body?{body:new URLSearchParams(body)}:{})});
try{
 for(const role of ['nastavnik','student','student2']){db[role]=client();await ok(db[role].auth.signInWithPassword(users[role]));}
 const m=await ok(service.from('memberships').select('*').match({institution_id:f.a,user_id:users.student2.id,role:'student'}));if(!m.length){await ok(service.from('memberships').insert({institution_id:f.a,user_id:users.student2.id,role:'student'}));membership=true;}
 const s=await ok(service.from('student_studies').select('id').match({institution_id:f.a,student_id:users.student2.id,program_id:f.programA,academic_year_id:f.yearA}));let sid=s[0]?.id;
 if(!sid){sid=randomUUID();await ok(service.from('student_studies').insert({id:sid,institution_id:f.a,student_id:users.student2.id,program_id:f.programA,academic_year_id:f.yearA,study_year:1,student_number:'COL-'+tag}));study=sid;}
 const e=await ok(service.from('course_enrollments').select('id').match({institution_id:f.a,course_id:f.courseA,student_id:users.student2.id}));if(!e.length){enrollment=randomUUID();await ok(service.from('course_enrollments').insert({id:enrollment,institution_id:f.a,course_id:f.courseA,student_id:users.student2.id,study_id:sid}));}
 await check('assigned teacher schedules a term; students and foreign-course teachers cannot schedule or forge records',async()=>{
  await deny(db.student.rpc('save_colloquium',args));await deny(db.nastavnik.rpc('save_colloquium',{...args,inst:f.b,course:f.courseB}));
  terms.push(await ok(db.nastavnik.rpc('save_colloquium',args)));
  await deny(db.student.from('colloquia').insert({institution_id:f.a,course_id:f.courseA,title:'Forged',starts_at:args.starts,registration_deadline:args.registration_end,withdrawal_deadline:args.withdrawal_end,capacity:20,created_by:users.student.id}));
 });
 await check('two students race for one seat; duplicate calls are idempotent and peer identities remain private',async()=>{
  const result=await Promise.all([db.student.rpc('register_colloquium',{target:terms[0]}),db.student2.rpc('register_colloquium',{target:terms[0]})]);assert.equal(result.filter(r=>!r.error).length,1);assert.equal(result.filter(r=>r.error?.message==='COLLOQUIUM_FULL').length,1);
  const winner=result[0].error?db.student2:db.student;await ok(winner.rpc('register_colloquium',{target:terms[0]}));
  assert.equal((await ok(service.from('colloquium_registrations').select('id').eq('colloquium_id',terms[0]))).length,1);
  assert.equal((await ok(db.nastavnik.from('colloquium_registrations').select('id').eq('colloquium_id',terms[0]))).length,1);
  const loser=result[0].error?db.student:db.student2;assert.equal((await ok(loser.from('colloquium_registrations').select('*').eq('colloquium_id',terms[0]))).length,0);
  await ok(winner.rpc('register_colloquium',{target:terms[0],withdraw:true}));await ok(loser.rpc('register_colloquium',{target:terms[0]}));
 });
 await check('registration and withdrawal deadlines, cancellation, and stale edits are enforced in SQL',async()=>{
  await deny(db.nastavnik.rpc('save_colloquium',{...args,target:terms[0],expected_revision:0}),'COLLOQUIUM_STALE');
  const closed=await ok(db.nastavnik.rpc('save_colloquium',{...args,label:'Closed '+tag,registration_end:new Date(Date.now()-60000).toISOString(),withdrawal_end:new Date(Date.now()-60000).toISOString()}));terms.push(closed);
  await deny(db.student.rpc('register_colloquium',{target:closed}),'COLLOQUIUM_CLOSED');await deny(db.student.rpc('register_colloquium',{target:closed,withdraw:true}),'COLLOQUIUM_CLOSED');
  await ok(db.nastavnik.rpc('save_colloquium',{...args,target:terms[0],expected_revision:1,is_cancelled:true}));await deny(db.student.rpc('register_colloquium',{target:terms[0]}),'COLLOQUIUM_CLOSED');
  await deny(db.student.rpc('register_colloquium',{target:randomUUID()}));
 });
 await check('Studomat renders teacher editing and student monthly views; mutation endpoint rejects foreign origins',async()=>{
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3021'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:c.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:c.ANON_KEY,SVS_SUPABASE_URL:c.API_URL,SVS_SUPABASE_SECRET_KEY:c.SERVICE_ROLE_KEY},stdio:'ignore'});
  let ready=false;for(let i=0;i<100;i++){try{if((await req('/')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(ready);
  for(const role of ['nastavnik','student']){
   const auth=await req('/api/auth/login',{...users[role],next:'studomat'});assert.equal(auth.status,303);const cookie=auth.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
   const page=await req('/?module=studomat&view=Kolokviji&institution='+f.a,null,cookie),html=await page.text();assert.equal(page.status,200);assert.ok(html.includes('Mjesec kolokvija'));assert.ok(html.includes(args.label));assert.equal(html.includes('action="/api/colloquia/save"'),role==='nastavnik');
   const filtered=await req('/?module=studomat&view=Kolokviji&institution='+f.a+'&date=2099-01',null,cookie);assert.ok(!(await filtered.text()).includes(args.label));
   const form={institution_id:f.a,course_id:f.courseA,title:'HTTP '+tag,starts_at:'2099-02-05T10:00',registration_deadline:'2099-02-04T10:00',withdrawal_deadline:'2099-02-04T10:00',capacity:'20'};
   const saved=await req('/api/colloquia/save',form,cookie);assert.equal(saved.status,303);
   assert.equal(new URL(saved.headers.get('location')).searchParams.get('status')==='saved',role==='nastavnik');
   if(role==='nastavnik'){const row=await ok(service.from('colloquia').select('id,starts_at').eq('title','HTTP '+tag).single());terms.push(row.id);assert.ok(row.starts_at.startsWith('2099-02-05T09:00:00'));}
   const denied=await req('/api/colloquia/register',{id:terms[0],institution_id:f.a},cookie,{origin:'https://evil.example'});assert.ok(denied.status>=400);
  }
 });
 console.log(`${count} colloquium scenarios passed.`);
}finally{
 if(server)server.kill('SIGTERM');if(terms.length){await ok(service.from('colloquium_registrations').delete().in('colloquium_id',terms));await ok(service.from('colloquia').delete().in('id',terms));}
 if(enrollment)await ok(service.from('course_enrollments').delete().eq('id',enrollment));if(study)await ok(service.from('student_studies').delete().eq('id',study));if(membership)await ok(service.from('memberships').delete().match({institution_id:f.a,user_id:users.student2.id,role:'student'}));
}
