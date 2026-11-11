import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validSubdomain} from '../src/lib/institutions/domains';
import {schemas} from '../src/lib/academic/validation';
import {registrarError} from '../src/lib/academic/registrar';
const read=(f:string)=>JSON.parse(readFileSync('data/study-programs/'+f,'utf8'));
const offers=read('source-2024.json'),programs=read('programs-2024.json'),institutions=read('new-institutions.json'),bindings=read('provider-bindings.json');
test('all 1313 historical PDF rows have reviewed provider mappings and a programme destination',()=>{
 assert.equal(offers.length,1313);assert.equal(bindings.length,179);assert.equal(programs.length,706);
 const sourceRows=new Set(programs.flatMap((p:any)=>p.catalog_source.offers.map((r:any)=>r.source_row)));
 assert.equal(sourceRows.size,1313);assert.ok(offers.every((r:any)=>sourceRows.has(r.source_row)&&r.provider&&r.city&&['Redovni','Izvanredni'].includes(r.mode)));
 assert.equal(new Set(programs.map((p:any)=>p.catalog_source_key)).size,706);
});
test('54 missing institutions and departments have unique nontechnical short labels; joint providers remain separate',()=>{
 assert.equal(institutions.length,54);assert.equal(new Set(institutions.map((r:any)=>r.registry_key)).size,54);
 assert.ok(institutions.every((r:any)=>validSubdomain(r.subdomain)&&r.name.length<=200));
 assert.ok(institutions.some((r:any)=>r.name==='Zdravstveno veleučilište u Zagrebu'));
 assert.ok(institutions.some((r:any)=>r.name==='Sveučilište Algebra'));
 const joint=bindings.find((b:any)=>b.provider.includes('Fakultet elektrotehnike i računarstva i Fakultet strojarstva'));
 assert.deepEqual(joint.institution_keys,['hr-isvu-125:016','hr-isvu-125:028']);
 const keySet=new Set([...institutions.map((r:any)=>r.registry_key),...JSON.parse(readFileSync('data/institutions/catalog-125.json','utf8')).map((r:any)=>r.registry_key)]);
 assert.ok(programs.every((p:any)=>keySet.has(p.institution_key)));
});
test('candidate cohorts and campuses do not multiply UFZG programmes; unknown duration and levels are not invented',()=>{
 const ufzg=programs.filter((p:any)=>p.institution_key==='hr-isvu-125:102');assert.equal(ufzg.length,4);
 const teacher=ufzg.find((p:any)=>p.name==='Učiteljski studij');assert.deepEqual(new Set(teacher.catalog_source.locations),new Set(['Zagreb','Čakovec','Petrinja']));
 assert.ok(programs.every((p:any)=>p.duration_years===null&&p.degree==='Nije navedeno'&&p.catalog_source.source_year===2024));
 assert.equal(programs.filter((p:any)=>p.catalog_requires_review).length,1);
 assert.ok(programs.every((p:any)=>!p.name.includes('Hrvati izvan RH')&&!p.name.includes('završili prije 2010.')));
 assert.equal(programs.filter((p:any)=>p.institution_key==='hr-isvu-125:117').length,6);
});
test('programme editing supports missing metadata and long source names, and still rejects invalid durations',()=>{
 const values={name:'P'.repeat(277),code:'PDF24-ABCDEF',degree:'Nije navedeno',duration_years:''};
 assert.equal(schemas.program.parse(values).duration_years,null);
 assert.equal(schemas.program.parse({...values,degree:'Integrirani',duration_years:'5'}).duration_years,5);
 assert.ok(!schemas.program.safeParse({...values,duration_years:'0'}).success);
 assert.ok(!schemas.program.safeParse({...values,duration_years:'9'}).success);
 assert.equal(registrarError('P0001','REGISTRAR_PROGRAM'),'registrar-program');
});
