import type {AcademicData} from '@/lib/academic/data';
import {colloquiumMonth,type Colloquium,type ColloquiumRegistration} from '@/lib/academic/colloquia';
import {zagrebInput,hrDate} from '@/lib/academic/time';
import {navigation} from '@/lib/context';
import {inputClass,Submit} from '@/components/auth/forms';
import {person} from './shared';
export async function Colloquia({data,month=''}:{data:AcademicData;month?:string}){
 const inst=data.institution.id,db=data.account.db,url=await navigation();
 const load=async<T,>(table:string)=>{const rows:T[]=[];for(let offset=0;;offset+=500){const r=await db.from(table).select('*').eq('institution_id',inst).order('id').range(offset,offset+499);if(r.error)return {rows,error:r.error};rows.push(...r.data as T[]);if(r.data.length<500)return{rows,error:null};}};
 const [terms,registrations]=await Promise.all([load<Colloquium>('colloquia'),load<ColloquiumRegistration>('colloquium_registrations')]);
 if(terms.error||registrations.error)return <p role="alert">Kolokviji nisu dostupni. Provjerite migraciju 202611250001_colloquia.sql.</p>;
 const selected=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month:'';
 const staffCourses=data.courses.filter(c=>data.manager||data.teachers.some(t=>t.course_id===c.id&&t.teacher_id===data.account.user.id));
 const owns=(c:Colloquium)=>staffCourses.some(course=>course.id===c.course_id);
 const hidden=<><input type="hidden" name="institution_id" value={inst}/><input type="hidden" name="date" value={selected}/></>;
 function Editor({term}:{term?:Colloquium}){return <form action="/api/colloquia/save" method="post" className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
  {hidden}{term&&<><input type="hidden" name="id" value={term.id}/><input type="hidden" name="revision" value={term.revision}/></>}
  <label>Kolegij<select name="course_id" required className={inputClass} defaultValue={term?.course_id}>{(term?staffCourses.filter(c=>c.id===term.course_id):staffCourses).map(c=><option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}</select></label>
  <label>Naziv kolokvija<input name="title" required minLength={2} maxLength={200} defaultValue={term?.title} className={inputClass}/></label>
  {(['starts_at','registration_deadline','withdrawal_deadline'] as const).map((name,i)=><label key={name}>{['Datum i vrijeme kolokvija','Rok prijave','Rok odjave'][i]} (Europe/Zagreb)<input type="datetime-local" name={name} required defaultValue={term?zagrebInput(term[name]):undefined} className={inputClass}/></label>)}
  <label>Broj mjesta<input type="number" name="capacity" min={1} max={10000} required defaultValue={term?.capacity||50} className={inputClass}/></label>
  {term&&<label><input type="checkbox" name="cancelled" defaultChecked={term.cancelled}/> Otkazan termin</label>}
  <Submit>{term?'Spremi izmjene':'Dodaj kolokvij'}</Submit>
 </form>;}
 const visible=terms.rows.filter(t=>!selected||colloquiumMonth(t.starts_at)===selected).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 const months=[...new Set(visible.map(t=>colloquiumMonth(t.starts_at)))];
 return <section className="space-y-6"><h2 className="text-2xl font-bold">Kolokviji</h2>
  <p>Prijave kolokvija odvojene su od ispita. Datum i vrijeme određuje profesor kolegija. Vrijeme se prikazuje za Hrvatsku.</p>
  <form action={url('studomat')} method="get" className="flex flex-wrap items-end gap-3"><input type="hidden" name="module" value="studomat"/><input type="hidden" name="institution" value={inst}/><input type="hidden" name="view" value="Kolokviji"/>
   <label>Mjesec kolokvija<input type="month" name="date" defaultValue={selected} className={inputClass}/></label><button className="rounded-lg bg-blue-700 px-4 py-2 text-white">Prikaži</button><a className="text-blue-700 underline" href={url('studomat')+(url('studomat').includes('?')?'&':'?')+new URLSearchParams({institution:inst,view:'Kolokviji'})}>Svi mjeseci</a>
  </form>
  {staffCourses.length>0&&<details><summary className="cursor-pointer font-semibold text-blue-700">Novi kolokvij</summary><Editor/></details>}
  {!visible.length&&<p>Nema kolokvija za odabrani mjesec.</p>}
  {months.map(m=><section key={m} className="space-y-4"><h3 className="text-xl font-semibold">{new Intl.DateTimeFormat('hr-HR',{month:'long',year:'numeric',timeZone:'Europe/Zagreb'}).format(new Date(m+'-15T12:00:00Z'))}</h3>
   {visible.filter(t=>colloquiumMonth(t.starts_at)===m).map(t=>{
    const mine=registrations.rows.find(r=>r.colloquium_id===t.id&&r.student_id===data.account.user.id&&r.registered);
    const active=registrations.rows.filter(r=>r.colloquium_id===t.id&&r.registered);
    const enrolled=data.enrollments.some(e=>e.course_id===t.course_id&&e.student_id===data.account.user.id);
    const now=Date.now(),open=!t.cancelled&&new Date(t.starts_at).getTime()>now;
    const allowed=open&&new Date(mine?t.withdrawal_deadline:t.registration_deadline).getTime()>=now;
    return <article key={t.id} className="space-y-3 rounded-xl border border-slate-200 p-5"><h4 className="text-lg font-bold">{t.title}</h4><p>{data.courses.find(c=>c.id===t.course_id)?.name} · {hrDate(t.starts_at)}</p>
     <p>Prijava do: {hrDate(t.registration_deadline)} · Odjava do: {hrDate(t.withdrawal_deadline)}</p>
     <p>{t.cancelled?'Termin je otkazan.':mine?'Prijavljeni ste.':allowed?'Prijave su otvorene.':'Rok za prijavu je zatvoren.'}</p>
     {enrolled&&!t.cancelled&&<form action={'/api/colloquia/'+(mine?'withdraw':'register')} method="post">{hidden}<input name="id" type="hidden" value={t.id}/><button disabled={!allowed} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{mine?'Odjavi kolokvij':'Prijavi kolokvij'}</button></form>}
     {owns(t)&&<><p>Prijavljeni: {active.length} / {t.capacity}</p><details><summary className="cursor-pointer text-blue-700">Prijavljeni studenti</summary><ul>{active.map(r=><li key={r.id}>{person(data,r.student_id)}</li>)}</ul>{!active.length&&<p>Nema prijavljenih studenata.</p>}</details>{open&&<details><summary className="cursor-pointer text-blue-700">Uredi termin</summary><Editor term={t}/></details>}{t.cancelled&&new Date(t.starts_at).getTime()>now&&<details><summary>Uredi otkazani termin</summary><Editor term={t}/></details>}</>}
    </article>;
   })}
  </section>)}
 </section>;
}
