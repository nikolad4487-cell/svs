#!/usr/bin/env python3
"""Read only the public official register. Never replace enrichment on a failed/ambiguous collection."""
import argparse, hashlib, json, os, re, ssl, time, unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parent.parent
SOURCE='https://www.isvu.hr/visokaucilista/hr/pretrazivanje'
class Node:
 def __init__(self,tag='',attrs=None,parent=None): self.tag,self.attrs,self.parent,self.children=tag,dict(attrs or []),parent,[]
 def text(self): return ' '.join(c.text() if isinstance(c,Node) else c for c in self.children).strip()
 def all(self,tag):
  result=[]
  for child in self.children:
   if isinstance(child,Node):
    if child.tag==tag: result.append(child)
    result.extend(child.all(tag))
  return result
class Document(HTMLParser):
 def __init__(self,html): super().__init__(convert_charrefs=True);self.root=Node();self.current=self.root;self.feed(html)
 def handle_starttag(self,tag,attrs):
  node=Node(tag,attrs,self.current);self.current.children.append(node)
  if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):self.current=node
 def handle_endtag(self,tag):
  parent=self.current
  while parent.parent is not None:
   if parent.tag==tag:self.current=parent.parent;return
   parent=parent.parent
 def handle_data(self,text):self.current.children.append(text)
def normalized(text): return re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFD',text.lower().replace('đ','dj')).encode('ascii','ignore').decode()).strip()
def website(value):
 if not value:return None
 if not re.match(r'^https?://',value):value='https://'+value
 u=urlparse(value)
 return value if u.scheme in ('http','https') and u.hostname and '.' in u.hostname and not u.username and not u.password and not re.search(r'\s',value) and len(value)<=2048 else None
def fields(html):
 doc=Document(html).root;result={}
 for row in doc.all('tr'):
  cells=[c for c in row.children if isinstance(c,Node) and c.tag in ('td','th')]
  if len(cells)==2:
   value=cells[1].text();links=cells[1].all('a')
   if links:value=links[0].attrs.get('href') or value
   result[normalized(cells[0].text())]=value
 for dt in doc.all('dt'):
  siblings=dt.parent.children;index=siblings.index(dt)
  dd=next((n for n in siblings[index+1:] if isinstance(n,Node)),None)
  if dd and dd.tag=='dd':result[normalized(dt.text())]=dd.text()
 return result
def collect(html,rows):
 doc=Document(html).root;links={}
 for row in doc.all('tr'):
  text=normalized(row.text())
  for anchor in row.all('a'):
   href=urljoin(SOURCE,anchor.attrs.get('href',''));u=urlparse(href)
   if u.hostname not in ('www.isvu.hr','isvu.hr') or not u.path.startswith('/visokaucilista/') or href==SOURCE:continue
   candidates=[r for r in rows if normalized(r['name'])==normalized(anchor.text()) and (not r['parent_name'] or normalized(r['parent_name']) in text) and normalized(r['headquarters']) in text]
   if len(candidates)==1:links[candidates[0]['registry_key']]=href
 return links
def fetch(url):
 u=urlparse(url)
 if u.scheme!='https' or u.hostname not in ('www.isvu.hr','isvu.hr'):raise RuntimeError('Only the requested official register host is permitted.')
 with urlopen(Request(url,headers={'User-Agent':'ISVU-catalog-reconciliation/1.0 (public institution metadata)'}),timeout=25,context=ssl.create_default_context()) as r:
  if urlparse(r.url).hostname not in ('www.isvu.hr','isvu.hr'):raise RuntimeError('Unexpected redirect: review the official source first.')
  return r.read().decode('utf-8')
def main():
 p=argparse.ArgumentParser();p.add_argument('--list-html',help='Optional saved, rendered HTML of the official list');args=p.parse_args()
 rows=json.loads((ROOT/'data/institutions/catalog-125.json').read_text());html=Path(args.list_html).read_text() if args.list_html else fetch(SOURCE)
 links=collect(html,rows)
 if len(links)!=125:raise RuntimeError(f'Found {len(links)}/125 unambiguous detail links. If the site renders client-side, save the rendered official HTML and pass --list-html. Existing enrichment was preserved.')
 out={};cache=ROOT/'.local-isvu-register';cache.mkdir(exist_ok=True)
 for i,row in enumerate(rows):
  url=links[row['registry_key']];detail=fetch(url);(cache/(row['registry_key'].split(':')[-1]+'.html')).write_text(detail)
  data=fields(detail);web=website(data.get('url') or data.get('web adresa') or data.get('internetska adresa'))
  source_id=data.get('sifra visokog ucilista') or data.get('sifra vu') or data.get('isvu identifikator')
  if source_id and not re.fullmatch(r'[0-9]{1,20}',source_id):source_id=None
  out[row['registry_key']]={'name':data.get('naziv visokog ucilista') or row['name'],'parent_name':data.get('nadredena ustanova') or row['parent_name'],'city':data.get('sjediste') or row['headquarters'],'official_website':web,'website_source':url,'source_url':url,'isvu_institution_id':source_id,'address':data.get('adresa'),'contact_email':data.get('e mail') or data.get('email'),'phone':data.get('telefon'),'verified':bool(web),'record_verified':True,'source_sha256':hashlib.sha256(detail.encode()).hexdigest()}
  if (i+1)%10==0:print(f'Read {i+1}/125 institution records.')
  time.sleep(.2)
 target=ROOT/'data/institutions/verified-enrichment.json';target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('Saved complete source enrichment. Review it, then run npm run catalog:build. No database changes were made.')
if __name__=='__main__':
 try:main()
 except Exception as error:
  raise SystemExit(f'Collection stopped: {error}. Existing enrichment was preserved; no database writes were made.')
