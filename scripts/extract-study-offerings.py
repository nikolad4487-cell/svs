import fitz,json,collections,re,sys,hashlib
from pathlib import Path
path=Path(sys.argv[1]);pdf=fitz.open(path)
rows=[];bad=[]
for pi,page in enumerate(pdf):
 chunks=[]
 for trace in page.get_texttrace():
  group=[]
  for char in trace['chars']:
   if group and (abs(char[2][1]-group[-1][2][1])>1 or char[2][0]<group[-1][2][0]-.5 or char[2][0]-group[-1][3][2]>5):
    chunks.append(group);group=[]
   group.append(char)
  if group:chunks.append(group)
 groups=collections.defaultdict(list)
 for g in chunks:
  text=''.join(chr(c[0]) for c in g).strip()
  if text:groups[round(g[0][2][1],1)].append((g[0][2][0],text))
 for y,cells in sorted(groups.items()):
  owner=[t for x,t in cells if 18<x<23]
  if not owner:continue
  r={'page':pi+1,'y':y,'owner':' '.join(owner)}
  for label,lo,hi in [('provider',242,247),('mode',516,520),('name',570,574),('city',912,917)]:
   r[label]=' '.join(t for x,t in cells if lo<x<hi)
  if not r['mode']:
   match=re.search(r'(Redovni|Izvanredni)$',r['provider'])
   if match:r['mode']=match[1];r['provider']=r['provider'][:match.start()].strip()
  # Three printed cells touch the location field without a whitespace character.
  if not r['city']:
   fix={(8,632.4):'Split',(17,249.2):'Dubrovnik',(19,731.3):'Požega'}.get((pi+1,y))
   if fix and r['name'].endswith(fix):r['city']=fix;r['name']=r['name'][:-len(fix)].strip()
  for key in ['owner','provider','name','city']:r[key]=re.sub(r'\s+',' ',r[key]).strip()
  r['source_row']=len(rows)+1
  if r['mode'] not in ['Redovni','Izvanredni'] or not r['provider'] or not r['name'] or not r['city']:bad.append((r,cells))
  rows.append(r)
if bad:raise ValueError(f'{len(bad)} unparsed rows: {bad}')
assert len(rows)==1313 and len(pdf)==23
out=Path('data/study-programs');out.mkdir(exist_ok=True,parents=True)
(out/'source-2024.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(out/'provenance.json').write_text(json.dumps({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':23,'source_year':2024,'created_at':'2024-07-17','rows':len(rows),'notes':'Historical admissions offer, not current quotas or proof of current accreditation. Text recovered from original PDF character traces, including overlapping columns. No duration/ECTS/level is inferred.'},ensure_ascii=False,indent=2)+'\n')
print(f'Extracted {len(rows)} complete offer rows from {len(pdf)} pages.')
