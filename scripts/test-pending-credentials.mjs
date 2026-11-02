import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localConfig } from './local-config.mjs';
const config=localConfig();
assert.ok(['localhost','127.0.0.1'].includes(new URL(config.API_URL).hostname));
const service=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const users=JSON.parse(readFileSync('.local-test-users.json','utf8'));
const port=Number(process.env.AUTH_TEST_PORT || 3004);
const request=(path,data,cookies='',json=false)=>new Promise((resolve,reject)=>{
 const body=json?JSON.stringify(data):new URLSearchParams(data).toString();
 const req=http.request({hostname:'127.0.0.1',port,path,method:'POST',headers:{host:`localhost:${port}`,origin:`http://localhost:${port}`,cookie:cookies,'content-type':json?'application/json':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body)}},res=>{
 let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:text}));
 });req.on('error',reject);req.end(body);
});
const login=await request('/api/auth/login',{email:users.superadmin.email,password:users.superadmin.password,next:'admin'});
assert.equal(login.status,303);
const cookies=(login.headers['set-cookie'] || []).map(c=>c.split(';')[0]).join('; ');
const institution='10000000-0000-4000-8000-000000000001';
const issued=[];
try {
 for (const existing of [false,true]) {
  const email=`pending-${randomUUID()}@example.test`;
  const invitation=await service.from('registration_invites').insert({institution_id:institution,email,role:'student'}).select('id').single();
  assert.ifError(invitation.error); const record={email,invite:invitation.data.id};issued.push(record);
  if(existing) {
   const user=await service.auth.admin.createUser({email,password:randomBytes(24).toString('base64url'),email_confirm:false,user_metadata:{full_name:'Test pending'}});
   assert.ifError(user.error);record.user=user.data.user.id;
  }
  const response=await request('/api/admin/pending-credentials',{invite_id:record.invite,activate:true},cookies,true);
  assert.equal(response.status,200,`Issuance failed with status ${response.status}`);
  assert.equal(response.headers['cache-control'],'private, no-store');
  const data=JSON.parse(response.body);record.user=data.userId;
  assert.equal(data.sheet.email,email);assert.ok(data.sheet.password.length>=12);
  const client=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false}});
  const signed=await client.auth.signInWithPassword({email,password:data.sheet.password});assert.ifError(signed.error);
  assert.equal(signed.data.user.app_metadata.svs_password_change_required,true);
  assert.equal((await client.rpc('session_is_active')).data,false);
  const accepted=await service.from('registration_invites').select('accepted_at,credentials_issued_at').eq('id',record.invite).single();
  assert.ok(accepted.data.accepted_at);assert.ok(accepted.data.credentials_issued_at);
  assert.equal((await request('/api/admin/pending-credentials',{invite_id:record.invite,activate:true},cookies,true)).status,409);
  assert.equal((await request('/api/admin/pending-credentials',{invite_id:record.invite,activate:false},cookies,true)).status,403);
  assert.equal((await request('/api/admin/pending-credentials',{invite_id:record.invite,activate:true},'',true)).status,403);
 }
 console.log('Pending credential tests passed: new and existing unconfirmed accounts, explicit activation, forced password change, no-store, duplicate and unauthorized request rejection.');
} finally {
 for(const record of issued) {
  if(record.user) assert.ifError((await service.auth.admin.deleteUser(record.user)).error);
  await service.from('registration_invites').delete().eq('id',record.invite);
 }
}
