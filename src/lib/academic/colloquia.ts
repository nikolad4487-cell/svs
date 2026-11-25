import {z} from 'zod';
import {fromZagrebLocal} from './time';
const localTime=z.string().transform((value,ctx)=>{try{return fromZagrebLocal(value);}catch{ctx.addIssue({code:'custom',message:'Neispravan datum ili hrvatsko lokalno vrijeme.'});return z.NEVER;}});
export const colloquiumSchema=z.object({
 institution_id:z.uuid(),course_id:z.uuid(),title:z.string().trim().min(2).max(200),
 starts_at:localTime,registration_deadline:localTime,withdrawal_deadline:localTime,
 capacity:z.coerce.number().int().min(1).max(10000),
}).refine(v=>v.registration_deadline<=v.starts_at&&v.withdrawal_deadline<=v.starts_at,{message:'Rok mora završiti prije početka kolokvija.'});
export const colloquiumMonth=(iso:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit'}).format(new Date(iso));
export const colloquiumErrors:Record<string,string>={
 'colloquium-invalid':'Provjerite datum, vrijeme, rokove i broj mjesta.',
 'colloquium-full':'Sva mjesta na kolokviju su popunjena.',
 'colloquium-closed':'Kolokvij je otkazan, započeo je ili je istekao rok za ovu radnju.',
 'colloquium-stale':'Termin je u međuvremenu izmijenjen. Osvježite stranicu.',
 'colloquium-capacity':'Broj mjesta ne smije biti manji od broja prijavljenih studenata.',
 'colloquium-error':'Promjena nije spremljena. Provjerite podatke, ovlasti i aktivni upis kolegija.',
};
export type Colloquium={id:string;institution_id:string;course_id:string;title:string;starts_at:string;registration_deadline:string;withdrawal_deadline:string;capacity:number;cancelled:boolean;revision:number};
export type ColloquiumRegistration={id:string;colloquium_id:string;student_id:string;registered:boolean};
