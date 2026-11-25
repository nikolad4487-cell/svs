import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {assertSameOrigin,requestContext} from '@/lib/auth/request';
import {requireIdentity} from '@/lib/auth/access';
import {colloquiumSchema,colloquiumErrors} from '@/lib/academic/colloquia';
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 try{
  await assertSameOrigin();if(Number(req.headers.get('content-length')||0)>16384)return NextResponse.json({error:'Prevelik obrazac.'},{status:413});
  const account=await requireIdentity('studomat'),form=await req.formData(),inst=z.uuid().parse(form.get('institution_id'));
  const {action}=await params;let error;
  if(action==='save'){
   const v=colloquiumSchema.parse(Object.fromEntries(form));
   const target=form.get('id')?z.uuid().parse(form.get('id')):null;
   ({error}=await account.db.rpc('save_colloquium',{target,inst,course:v.course_id,label:v.title,starts:v.starts_at,registration_end:v.registration_deadline,withdrawal_end:v.withdrawal_deadline,seats:v.capacity,expected_revision:z.coerce.number().int().min(0).parse(form.get('revision')||0),is_cancelled:form.get('cancelled')==='on'}));
  }else if(action==='register'||action==='withdraw'){
   const target=z.uuid().parse(form.get('id'));
   const row=await account.db.from('colloquia').select('id').eq('id',target).eq('institution_id',inst).single();
   if(row.error||!row.data)throw Error('Forbidden');
   ({error}=await account.db.rpc('register_colloquium',{target,withdraw:action==='withdraw'}));
  }else return NextResponse.json({error:'Nepoznata radnja.'},{status:404});
  const {url}=await requestContext(),to=new URL(url('studomat'));to.searchParams.set('institution',inst);to.searchParams.set('view','Kolokviji');
  const month=String(form.get('date')||'');if(/^\d{4}-(0[1-9]|1[0-2])$/.test(month))to.searchParams.set('date',month);
  const status=error?'colloquium-'+String(error.message).replace(/^COLLOQUIUM_/,'').toLowerCase():'saved';
  to.searchParams.set('status',error&&!colloquiumErrors[status]?'colloquium-error':status);
  return NextResponse.redirect(to,303);
 }catch{return NextResponse.json({error:'Provjerite podatke i ovlasti za kolegij. Promjena nije spremljena.'},{status:400});}
}
