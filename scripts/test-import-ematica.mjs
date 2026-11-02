import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localConfig } from './local-config.mjs';
const c=localConfig();
assert.ok(['localhost','127.0.0.1'].includes(new URL(c.API_URL).hostname));
const service=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const inst='10000000-0000-4000-8000-000000000001';
const program=await service.from('study_programs').select('id').eq('institution_id',inst).limit(1).single();
const year=await service.from('academic_years').select('id').eq('institution_id',inst).limit(1).single();
assert.ifError(program.error);assert.ifError(year.error);
const studentId=randomUUID(), sourceProgram=randomUUID(), sourceYear=randomUUID();
const fixture={id:randomUUID(),school_id:'source-college',program_id:sourceProgram,school_year_id:sourceYear,status:'ACTIVE',schools:{education_level:'HIGHER'},registry_students:{id:studentId,first_name:'Testni',last_name:'Uvoz'}};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  assert.equal(url.pathname,'/rest/v1/student_school_enrollments');
  assert.equal(url.searchParams.get('status'),'eq.ACTIVE');
  assert.equal(url.searchParams.get('schools.education_level'),'eq.HIGHER');
  assert.ok(!url.searchParams.get('select').includes('oib'));
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify([fixture]));
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const temp=mkdtempSync(join(tmpdir(),'svs-import-test-'));
const config=join(temp,'mapping.json');
writeFileSync(config,JSON.stringify([{school_id:fixture.school_id,program_id:sourceProgram,school_year_id:sourceYear,institution_id:inst,svs_program_id:program.data.id,academic_year_id:year.data.id,domain:'example.test'}]));
const env={...process.env,EMATICA_SUPABASE_URL:`http://127.0.0.1:${server.address().port}`,EMATICA_SUPABASE_SECRET_KEY:'local-source-fixture',SVS_SUPABASE_URL:c.API_URL,SVS_SUPABASE_SECRET_KEY:c.SERVICE_ROLE_KEY};
const run=async(args)=>promisify(execFile)(process.execPath,['scripts/import-ematica.mjs','--config',config,...args],{env});
const appRequest = (path, data, cookies='') => new Promise((resolve,reject)=>{
  const port=Number(process.env.AUTH_TEST_PORT || 3002), body=new URLSearchParams(data).toString();
  const req=http.request({hostname:'127.0.0.1',port,path,method:'POST',headers:{host:`localhost:${port}`,origin:`http://localhost:${port}`,'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body),cookie:cookies}},res=>{
    res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));
  });req.on('error',reject);req.end(body);
});
let user, email;
try {
  const preview=await run([]);assert.match(preview.stdout,/1 novih računa/);
  const output=join(temp,'credentials.jsonl');
  await run(['--apply','--credentials',output]);
  assert.equal(statSync(output).mode & 0o777,0o600);
  const lines=readFileSync(output,'utf8').trim().split('\n').map(JSON.parse);
  const candidate=lines.find(x=>x.status==='candidate');email=candidate.email;
  user=lines.find(x=>x.status==='created').user_id;
  const client=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.ifError((await client.auth.signInWithPassword({email,password:candidate.password})).error);
  assert.equal((await client.auth.getUser()).data.user.app_metadata.svs_password_change_required,true);
  assert.equal((await client.from('memberships').select('*')).data.length,0);
  assert.equal((await client.rpc('session_is_active')).data,false);
  assert.equal((await client.rpc('password_change_session_is_active')).data,true);
  const newPassword=randomBytes(24).toString('base64url');
  const login=await appRequest('/api/auth/login',{email,password:candidate.password,next:'portal'});
  assert.equal(login.status,303);assert.ok(login.headers.location.includes('mode=password'));
  const cookies=(login.headers['set-cookie'] || []).map(c=>c.split(';')[0]).join('; ');
  assert.equal((await appRequest('/api/account/profile',{full_name:'Forbidden'},cookies)).status,403);
  const change=await appRequest('/api/auth/password',{password:newPassword},cookies);
  assert.equal(change.status,303);assert.ok(change.headers.location.includes('password-changed'));
  assert.ifError((await client.auth.signInWithPassword({email,password:newPassword})).error);
  assert.equal((await client.rpc('session_is_active')).data,true);
  const memberships=await client.from('memberships').select('*');assert.ifError(memberships.error);assert.equal(memberships.data.length,1);
  const studies=await client.from('student_studies').select('*');assert.ifError(studies.error);assert.equal(studies.data.length,1);
  const repeatOutput=join(temp,'repeat.jsonl');
  const repeated=await run(['--apply','--credentials',repeatOutput]);assert.match(repeated.stdout,/0 novih računa/);
  assert.equal(readFileSync(repeatOutput,'utf8'),'');
  assert.ifError((await client.auth.signInWithPassword({email,password:newPassword})).error);
  assert.equal((await client.from('student_studies').select('*')).data.length,1);
  console.log('Import test passed: source request, preview, new account, 0600 credentials, initial password restriction, password change, RLS, enrollment and repeat without password rotation.');
} finally {
  if (user) {
    assert.ifError((await service.from('student_studies').delete().eq('student_id',user)).error);
    assert.ifError((await service.auth.admin.deleteUser(user)).error);
  }
  if (email) await service.from('registration_invites').delete().eq('email',email);
  server.close();rmSync(temp,{recursive:true,force:true});
}
