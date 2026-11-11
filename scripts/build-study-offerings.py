#!/usr/bin/env python3
"""Build a reviewed, reproducible catalogue. Never infer current quotas, duration or degree."""
import json,re,hashlib,unicodedata,csv
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
DATA=ROOT/'data/study-programs'
def read(name):return json.loads((DATA/name).read_text())
def norm(s):return re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFD',s.lower().replace('đ','dj')).encode('ascii','ignore').decode()).strip()
def canonical(s):
 s=re.sub(r'\(\(([^()]*)\)\s*završili prije 2010\.\)',r'(\1)',s,flags=re.I)
 s=re.sub(r'\(izvanredni,\s*stručni\)','(stručni)',s,flags=re.I)
 s=re.sub(r'\((?:izvanredni|Hrvati izvan R[HhR]|[^()]*2010[^()]*|građanstvo)\)','',s,flags=re.I)
 return re.sub(r'\s+',' ',s).strip()
def uid(key):
 h=hashlib.sha256(key.encode()).hexdigest();return f'{h[:8]}-{h[8:12]}-5{h[13:16]}-a{h[17:20]}-{h[20:32]}'
source=read('source-2024.json');bindings=read('provider-bindings.json');institutions=read('new-institutions.json');prov=read('provenance.json')
by_provider={(b['owner'],b['provider']):b for b in bindings};programs={}
assert len(source)==1313 and len(by_provider)==179
for row in source:
 binding=by_provider[row['owner'],row['provider']];name=canonical(row['name']);keys=binding['institution_keys']
 if binding.get('selector')=='zagreb_pmf_math_or_science':keys=['hr-isvu-125:082' if norm(name).startswith('matematika') else 'hr-isvu-125:083']
 for inst in keys:
  key='pdf-admissions-2024:program:'+hashlib.sha256((inst+'|'+norm(name)).encode()).hexdigest()[:24]
  if key not in programs:programs[key]={'id':uid(key),'catalog_source_key':key,'institution_key':inst,'name':name,'code':'PDF24-'+key[-12:].upper(),'degree':'Nije navedeno','duration_years':None,'catalog_requires_review':False,'catalog_source':{'source_file':prov['file'],'source_sha256':prov['sha256'],'source_year':2024,'metadata_note':'Duration and degree are not stated. Historical offers are not current quotas or accreditation.','modes':[],'locations':[],'offers':[]}}
  p=programs[key];m=p['catalog_source'];m['offers'].append(row)
  if row['mode'] not in m['modes']:m['modes'].append(row['mode'])
  if row['city'] not in m['locations']:m['locations'].append(row['city'])
  if row['page']==7 and row['y']==187.4:p['catalog_requires_review']=True;m['review_note']='Source text of the list of coaching specialisations ends at Ku; no missing specialisations were invented.'
programs=sorted(programs.values(),key=lambda p:(p['institution_key'],p['name']))
assert len(set(p['catalog_source_key'] for p in programs))==len(programs)
assert {o['source_row'] for p in programs for o in p['catalog_source']['offers']}==set(range(1,1314))
(DATA/'programs-2024.json').write_text(json.dumps(programs,ensure_ascii=False,indent=2)+'\n')
# Frozen import snapshot: later source revisions require an additional migration, never rewrite a published one.
seed=ROOT/'supabase/migrations/202611110007_study_offerings_2024.sql'
if not seed.exists():
 inst_json=json.dumps(institutions,ensure_ascii=False,separators=(',',':'));program_json=json.dumps(programs,ensure_ascii=False,separators=(',',':'))
 seed.write_text('-- Reviewed source snapshot. Adds missing institutions and programmes; never enrols students.\nselect public.import_study_offerings_2024($institutions$'+inst_json+'$institutions$::jsonb,$programs$'+program_json+'$programs$::jsonb);\n')
cat=json.loads((ROOT/'data/institutions/catalog-125.json').read_text());names={r['registry_key']:r['name']+(' ('+r['parent_name']+')' if r.get('parent_name') else '') for r in cat+institutions}
report=ROOT/'reports/studijski-programi-2024.md'
counts={key:sum(p['institution_key']==key for p in programs) for key in names}
report.write_text('# Uvoz studijskih programa iz popisa 2024.\n\nIzvor: '+prov['file']+' (23 stranice, 17. 7. 2024.), SHA-256: `'+prov['sha256']+'`.\n\n'+f'Obrađeno: {len(source)} izvornih redaka, {len(bindings)} kombinacija nositelja i izvođača, {len(institutions)} novih ustanova/odjela i {len(programs)} zapisa programa po ustanovama. Zajednički studij evidentira se kod svakog navedenog izvođača. Svi izvorni redci imaju odredište.\n\n'+'''Trajanje i razina novim programima nisu izmišljeni; referada ih treba dopuniti prije upisa. Stare upisne kvote nisu aktualne kvote. Varijante kandidata, lokacije i redovno/izvanredno studiranje sačuvani su kao izvorna ponuda, bez stvaranja lažnih zasebnih programa. Izvorni PDF nije potvrda današnje akreditacije. Postojeći program istog naziva u istoj ustanovi zadržava svoj UUID i ručne podatke.

## Ustanove i broj programa

| Ustanova | Programi iz PDF-a | Status |
|---|---:|---|
'''+ '\n'.join(f'| {names[k]} | {counts[k]} | '+('Nova ustanova/odjel' if any(n['registry_key']==k for n in institutions) else 'Postojeća ustanova')+' |' for k in sorted(names,key=lambda k:(names[k],k)))+'''

## Pregled i iznimke

- Jedan izvorni zapis izobrazbe trenera na 7. stranici ima skraćen popis smjerova. Sačuvan je dostavljeni tekst i program je označen za provjeru.
- PMF Zagreb: matematički programi povezani su s matematičkim odsjekom, ostali s prirodoslovnim odsjecima. Postojeće ručne poddomene nisu mijenjane.
- Zajednički izvođači razloženi su na stvarne navedene ustanove; nije stvorena lažna ustanova čiji je naziv popis više fakulteta.
- Sjedišta novih ustanova preuzeta su iz mjesta izvođenja programa u PDF-u i nisu neovisno verificirane službene adrese. Novi službeni URL-ovi nisu izmišljeni.
- Svaki izvorni redak, način studiranja, lokacija, stranica i mapiranje dostupni su u data/study-programs. Detaljni programi su u priloženom CSV-u.
- Primjena produkcijske migracije i stvarni produkcijski brojevi provjeravaju se odvojeno; pripremljen katalog i lokalni testovi to ne zamjenjuju.
''')
with (ROOT/'reports/studijski-programi-2024.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f,delimiter=';');w.writerow(['Ustanova','Ključ ustanove','Studijski program','Način studiranja u izvoru','Mjesta izvođenja','Stranice PDF-a','Trajanje','Razina','Provjera izvornog teksta'])
 for p in programs:w.writerow([names[p['institution_key']],p['institution_key'],p['name'],', '.join(p['catalog_source']['modes']),', '.join(p['catalog_source']['locations']),', '.join(map(str,sorted(set(o['page'] for o in p['catalog_source']['offers'])))),'Nije navedeno','Nije navedeno',p['catalog_requires_review']])
print(json.dumps({'source_rows':len(source),'provider_bindings':len(bindings),'new_institutions':len(institutions),'programme_records':len(programs),'institutions_with_programmes':sum(n>0 for n in counts.values()),'existing_institutions_without_source_programmes':sum(counts[r['registry_key']]==0 for r in cat),'review':sum(p['catalog_requires_review'] for p in programs)}))
