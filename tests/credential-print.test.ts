import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCredentialSheets, credentialPrintDocument } from '../src/lib/admin/credential-print';
const account = {status:'candidate',email:'ana@fakultet.example',password:'Initial-Password-123',full_name:'Ana <Horvat>',institution:'Učilište & akademija'};
const created = {status:'created',email:account.email,user_id:'10000000-0000-4000-8000-000000000001'};
const jsonl = (...rows: unknown[]) => rows.map(r=>JSON.stringify(r)).join('\n');
test('printing includes confirmed accounts only and accepts older exports',()=>{
  const sheets=parseCredentialSheets(jsonl(account,created,{...account,email:'failed@fakultet.example'}));
  assert.equal(sheets.length,1); assert.equal(sheets[0].full_name,account.full_name);
  assert.equal(parseCredentialSheets(jsonl({status:'candidate',email:account.email,password:account.password},created)).length,1);
  assert.throws(()=>parseCredentialSheets(jsonl(account)));
  assert.throws(()=>parseCredentialSheets(jsonl(created)));
  assert.throws(()=>parseCredentialSheets(jsonl(account,created,created)));
  assert.throws(()=>parseCredentialSheets(jsonl(account,created,account)));
  assert.throws(()=>parseCredentialSheets('not json'));
});
test('print sheet escapes personal data, separates users and requires safe login URLs',()=>{
  const html=credentialPrintDocument([account,{...account,email:'marko@fakultet.example'}],'https://app.example/?module=auth');
  assert.equal((html.match(/<section>/g)||[]).length,2);
  assert.ok(html.includes('Ana &lt;Horvat&gt;'));
  assert.ok(html.includes('Učilište &amp; akademija'));
  assert.ok(html.includes(account.password));
  assert.ok(html.includes('break-after:page'));
  assert.ok(html.includes('obvezno postavite vlastitu lozinku'));
  assert.ok(!html.includes('<script'));
  assert.throws(()=>credentialPrintDocument([account],'javascript:alert(1)'));
});
