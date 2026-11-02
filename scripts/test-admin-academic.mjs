import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {localConfig} from './local-config.mjs';
const c=localConfig();assert.ok(['localhost','127.0.0.1'].includes(new URL(c.API_URL).hostname));
const db=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const port=Number(process.env.AUTH_TEST_PORT || 3005), host=`localhost:${port}`;
const request=(path,data,cookies='')=>new Promise((resolve,reject)=>{
 const body=data?new URLSearchParams(data).toString():'';
 const req=http.request({hostname:'127.0.0.1',port,path,method:data?'POST':'GET',headers:{host,origin:`http://${host}`,cookie:cookies,...(data?{'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body)}:{})}},res=>{
 let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:text}));
 });req.on('error',reject);req.end(body);
});
const resources=[], email=`academic-admin-${randomUUID()}@example.test`, password=randomBytes(24).toString('base64url');
let user;
try {
 const created=await db.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);user=created.data.user.id;
 assert.ifError((await db.from('superadmins').insert({user_id:user})).error);
 assert.equal((await db.from('memberships').select('*').eq('user_id',user)).data.length,0);
 const login=await request('/api/auth/login',{email,password,next:'admin'});assert.equal(login.status,303);
 const cookies=(login.headers['set-cookie']||[]).map(v=>v.split(';')[0]).join('; ');
 const institution='10000000-0000-4000-8000-000000000001';
 for(const [view,action] of [['Studijski programi','program'],['Akademske godine','year'],['Kolegiji','course'],['Studenti i upisi','study'],['Dvorane','room'],['Ispitni rokovi','exam'],['Upravljanje terminima','schedule'],['Obavijesti','announcement']]) {
  const page=await request(`/?module=admin&view=${encodeURIComponent(view)}&institution=${institution}`,null,cookies);
  assert.equal(page.status,200);assert.ok(page.body.includes(`/api/academic/${action}`),view);
  assert.ok(page.body.includes('name="return_module" value="admin"'));
 }
 const create=async(action,table,view,fields)=>{
  const result=await request(`/api/academic/${action}`,{institution_id:institution,return_module:'admin',return_view:view,...fields},cookies);
  assert.equal(result.status,303);assert.ok(result.headers.location.includes('status=saved'),action);
  assert.ok(result.headers.location.includes('module=admin'));assert.ok(result.headers.location.includes(`institution=${institution}`));
  const row=await db.from(table).select('id').eq('institution_id',institution).eq('name',fields.name).single();assert.ifError(row.error);
  resources.push([table,row.data.id]);return row.data.id;
 };
 const tag=randomUUID().slice(0,8);
 const program=await create('program','study_programs','Studijski programi',{name:`Admin program ${tag}`,code:`AP-${tag}`,degree:'Stručni',duration_years:'3'});
 const year=await create('year','academic_years','Akademske godine',{name:`2034/2035-${tag}`,starts_on:'2034-10-01',ends_on:'2035-09-30'});
 const semester=await create('semester','semesters','Akademske godine',{name:`Semestar ${tag}`,academic_year_id:year,starts_on:'2034-10-01',ends_on:'2035-02-01'});
 await create('course','courses','Kolegiji',{name:`Admin kolegij ${tag}`,code:`AK-${tag}`,program_id:program,semester_id:semester,ects:'5'});
 await create('room','rooms','Dvorane',{name:`Admin dvorana ${tag}`,capacity:'30'});
 const coursePage=await request(`/?module=admin&view=Kolegiji&institution=${institution}`,null,cookies);
 assert.ok(coursePage.body.includes(`Admin kolegij ${tag}`));
 console.log('Admin academic checks passed: superadministrator without memberships, all eight management sections, creation of program/year/semester/course/room, correct admin redirects and saved course rendering.');
} finally {
 for(const [table,id] of resources.reverse())assert.ifError((await db.from(table).delete().eq('id',id)).error);
 if(user)assert.ifError((await db.auth.admin.deleteUser(user)).error);
}
