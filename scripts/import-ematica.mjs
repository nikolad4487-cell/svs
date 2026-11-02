// Server-side administrative tool. Never ship either project's secret key to a browser.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync, openSync, writeSync, closeSync, fsyncSync, realpathSync } from 'node:fs';
import { z } from 'zod';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planImport } from './lib/ematica-import.mjs';

const mappingSchema = z.object({
  school_id: z.string().min(1), program_id: z.uuid(), school_year_id: z.uuid(),
  institution_id: z.uuid(), svs_program_id: z.uuid(), academic_year_id: z.uuid(),
  domain: z.string().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  study_year: z.number().int().min(1).max(8).default(1),
});
async function rows(query) {
  const result = [];
  for (let offset = 0;; offset += 500) {
    const {data, error} = await query().range(offset, offset + 499);
    if (error) throw new Error('Dohvat podataka nije uspio; provjerite shemu i pristup.');
    result.push(...data);
    if (data.length < 500) return result;
  }
}
const required = ['EMATICA_SUPABASE_URL', 'EMATICA_SUPABASE_SECRET_KEY', 'SVS_SUPABASE_URL', 'SVS_SUPABASE_SECRET_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`Nedostaje ${name}. Postavite vrijednost kroz sigurne serverske postavke.`);
const args = process.argv.slice(2), apply = args.includes('--apply');
const configIndex = args.indexOf('--config');
if (configIndex < 0 || !args[configIndex + 1]) throw new Error('Obvezno: --config /putanja/mapiranje.json');
const mappings = z.array(mappingSchema).min(1).parse(JSON.parse(readFileSync(args[configIndex + 1], 'utf8')));
const sourceUrl = new URL(process.env.EMATICA_SUPABASE_URL);
const targetUrl = new URL(process.env.SVS_SUPABASE_URL);
for (const url of [sourceUrl, targetUrl]) if (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Udaljeni Supabase zahtijeva HTTPS.');
if (sourceUrl.origin === targetUrl.origin) throw new Error('Izvorna i ciljna baza moraju biti zasebni projekti.');
const options = {auth: {persistSession:false, autoRefreshToken:false}};
const source = createClient(sourceUrl.origin, process.env.EMATICA_SUPABASE_SECRET_KEY, options);
const target = createClient(targetUrl.origin, process.env.SVS_SUPABASE_SECRET_KEY, options);
// Read only the explicitly mapped source school years, without OIB, birth dates or previous passwords.
const enrollments = [];
for (const schoolYear of new Set(mappings.map(m => m.school_year_id))) {
  enrollments.push(...await rows(() => source.from('student_school_enrollments')
    .select('id,school_id,program_id,school_year_id,status,registry_students!inner(id,first_name,last_name),schools!inner(education_level)')
    .eq('status','ACTIVE').eq('schools.education_level','HIGHER').eq('school_year_id', schoolYear)
    .in('school_id', [...new Set(mappings.filter(m => m.school_year_id === schoolYear).map(m => m.school_id))]).order('id')));
}
const plans = planImport(enrollments, mappings, sourceUrl.origin);
const readiness = await target.rpc('password_change_session_is_active');
if (readiness.error) throw new Error('Primijenite SVS migraciju 202611020002_import_passwords.sql prije uvoza.');
const institutionNames = new Map();
for (const m of mappings) {
  const [institution, program, year] = await Promise.all([
    target.from('institutions').select('name,active,email_domains').eq('id',m.institution_id).single(),
    target.from('study_programs').select('id').eq('id',m.svs_program_id).eq('institution_id',m.institution_id).single(),
    target.from('academic_years').select('id').eq('id',m.academic_year_id).eq('institution_id',m.institution_id).single(),
  ]);
  if (institution.error || program.error || year.error || !institution.data.active || !institution.data.email_domains.includes(m.domain)) throw new Error('Neispravno SVS mapiranje ili domena nije dopuštena u aktivnoj ustanovi.');
  institutionNames.set(m.institution_id, institution.data.name);
}
const users = [];
for (let page=1;;page++) {
  const {data,error} = await target.auth.admin.listUsers({page,perPage:500});
  if (error) throw new Error('Administratorski pristup SVS Auth servisima nije dostupan.');
  users.push(...data.users);
  if (data.users.length < 500) break;
}
const byImport = new Map(), byEmail = new Map();
for (const u of users) {
  if (u.app_metadata?.ematica_import_key) {
    if (byImport.has(u.app_metadata.ematica_import_key)) throw new Error('Duplicirana veza uvezenih računa; potrebna je ručna provjera.');
    byImport.set(u.app_metadata.ematica_import_key,u);
  }
  if (u.email) byEmail.set(u.email.toLowerCase(),u);
}
const unique = new Map(plans.map(p => [p.key,p]));
for (const p of unique.values()) {
  if (byImport.has(p.key)) {
    if (byImport.get(p.key).email !== p.email) throw new Error('Identitet ili domena postojećeg računa se promijenila; automatsko preimenovanje nije dopušteno.');
  } else if (byEmail.has(p.email)) throw new Error('Korisničko ime već pripada nepovezanom računu; automatsko preuzimanje nije dopušteno.');
}
console.log(`Provjera: ${plans.length} upisa; ${[...unique.keys()].filter(k=>!byImport.has(k)).length} novih računa. Bez ispisa osobnih podataka.`);
if (!apply) {
  console.log('Pregled završen bez spremanja. Za izvršenje koristite --apply --credentials /sigurna/putanja/novi-racuni.jsonl.');
  process.exit(0);
}
const outputIndex = args.indexOf('--credentials');
if (outputIndex < 0 || !args[outputIndex+1]) throw new Error('Potrebna je nova zaštićena izlazna datoteka za pristupne podatke.');
// Exclusive creation prevents overwriting credentials from an earlier import.
const outputPath = resolve(args[outputIndex+1]);
const checkout = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const outputParent = realpathSync(dirname(outputPath));
const relation = relative(checkout, outputParent);
if (relation === '' || (!relation.startsWith('../') && relation !== '..')) throw new Error('Datoteka s lozinkama mora biti izvan SVS repozitorija.');
const output = openSync(outputPath, 'wx', 0o600);
let created=0;
try {
  for (const p of plans) {
    let user = byImport.get(p.key);
    if (!user) {
      const password = randomBytes(24).toString('base64url');
      // Save before the remote call so a network failure cannot lose a newly created password.
      writeSync(output, JSON.stringify({status:'candidate',email:p.email,password,full_name:p.full_name,institution:institutionNames.get(p.mapping.institution_id)})+'\n');
      fsyncSync(output);
      const pending = await target.from('registration_invites').select('id').eq('institution_id',p.mapping.institution_id).eq('email',p.email).eq('role','student').is('accepted_at',null).maybeSingle();
      if (pending.error) throw new Error('Provjera administratorskog poziva nije uspjela.');
      const invitation = pending.data
        ? await target.from('registration_invites').update({expires_at:new Date(Date.now()+7*86400000).toISOString()}).eq('id',pending.data.id)
        : await target.from('registration_invites').insert({institution_id:p.mapping.institution_id,email:p.email,role:'student'});
      if (invitation.error) throw new Error('Administratorski poziv nije spremljen; provjerite domenu ustanove.');
      const {data,error} = await target.auth.admin.createUser({email:p.email,password,email_confirm:true,
        user_metadata:{full_name:p.full_name},app_metadata:{ematica_import_key:p.key,svs_password_change_required:true}});
      if (error || !data.user) throw new Error('Stvaranje računa nije potvrđeno. Sačuvajte izlaznu datoteku i ponovno pokrenite pregled; ne mijenjajte postojeće lozinke.');
      user = data.user; byImport.set(p.key,user); created++;
      writeSync(output, JSON.stringify({status:'created',email:p.email,user_id:user.id})+'\n');
    }
    // Administrative provisioning is the explicit approval, not self-registration.
    // Domain and source enrollment have been checked before any write.
    const m=p.mapping;
    const member=await target.from('memberships').upsert({institution_id:m.institution_id,user_id:user.id,role:'student'});
    if (member.error) throw new Error('Račun je sačuvan, ali članstvo nije spremljeno. Ponovite uvoz nakon provjere.');
    const study=await target.from('student_studies').upsert({institution_id:m.institution_id,student_id:user.id,
      program_id:m.svs_program_id,academic_year_id:m.academic_year_id,study_year:m.study_year,
      student_number:`EM-${p.student_id.replaceAll('-','')}`,status:'active'},
      {onConflict:'institution_id,student_id,program_id,academic_year_id',ignoreDuplicates:true});
    if (study.error) throw new Error('Račun i članstvo su sačuvani, ali upis nije spremljen. Ponovite nakon provjere mapiranja.');
  }
} finally { closeSync(output); }
console.log(`Uvoz završen: ${created} novih računa. Lozinke postojećih računa nisu promijenjene. Pristupne podatke dostavite zasebnim sigurnim kanalom.`);
