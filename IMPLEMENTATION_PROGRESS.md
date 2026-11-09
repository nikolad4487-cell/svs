# Nadogradnja ISVU-a prema dostavljenom vodiču

Naziv ISVU je potvrđen. Prilozi su specifikacijski materijal za postojeći zahtjev; nisu odobrenje za objavu, promjenu domena ili produkcijskih podataka.

| Faza | Stanje | Preostalo |
| --- | --- | --- |
| Audit i temelj | Audit i osnovni CI gotovi; postojeći Auth/RLS radi | MFA, detaljnije uloge i sigurnosna revizija |
| Nastavna struktura | Osnovni katalog postoji | Verzije, preduvjeti i izborna pravila |
| Referada i upisi | Osam referadskih postupaka, dosjei, godišnji podaci, početni pristup i dovršavanje implementirani | Puni verzionirani pravilnik i napredna PDS pravila |
| Studomat | Samoposlužni pregledi i razlozi blokade upisa implementirani | Upise prema odluci korisnika provodi referada; preostaje potpuna dokumentacija studentskih usluga |
| Ispiti i ocjene | Stanja, zaključavanje, nedolazak i povijest ispravaka implementirani | Pismeni/usmeni dio, povjerenstva, pravila izlazaka i outbox |
| Financije i potvrde | Osnovne evidencije postoje | Ledger, idempotentne uplate, vlastiti PDF/QR |
| Završetak i analitika | Osobni ECTS i agregati postoje | Priznavanje, obrana, uvjeti završetka |
| LMS i integracije | Nije početo | Odobreni adapteri, LMS, institucionalna pošta |

## Izvori i provjere

Audit: [docs/ISVO_AUDIT.md](docs/ISVO_AUDIT.md). Izravni službeni wiki još nije dostupan iz ovog okruženja. Ne označavati cijelu fazu dovršenom na temelju samo jednog novog postupka. Migracije su ispitane lokalno; korisnik je naknadno potvrdio primjenu triju novih datoteka u Supabaseu. Produkcijsku bazu agent nije mijenjao. Korisnik je zatim odobrio objavu pripremljenih izmjena putem povezane grane main; završni status Vercela provjerava se odvojeno.

## Dovršene vertikale ove iteracije

- Nacrt godišnjeg upisa → provjera referade → dovršen upis, četiri provjere i stvarni kolegiji, očekivana revizija, ponovno otvaranje, razlozi blokade ispita i iduće godine. Postojeći upisi ostaju izričito neprovjereni uz opisanu migracijsku iznimku.
- Nacrt ispitnog roka → otvorene/zatvorene prijave → provedba → obrada → zaključavanje. Povlašteno otključavanje uz razlog, neprolazna ocjena odvojena od nedolaska, kontrolirana povijest ispravaka. Neobjavljeni nacrti skriveni su studentima i na razini RLS-a.
- Tri nove migracije (`202611060002`–`202611060004`), 29 aplikacijskih RLS tablica, nadograđeni API i UI, GitHub workflow bez produkcijskih tajni.
- Popravljena stara izvorna migracija prvog upisa iz postojećeg spremljenog instalera; produkcija nije dirana.

## Dokazi provjere

- 42 jedinična testa prolaze, uključujući odsutnost i ispravak rezultata bez pogrešnog ECTS/prosjeka.
- Typecheck i produkcijski `next build --webpack` prolaze.
- Nova SQL instalacija na zasebnoj lokalnoj PostgreSQL bazi prolazi s pravom Auth shemom i 29 RLS tablica.
- 8 scenarija dovršenosti upisa prolazi, uključujući stvarni Chromium postupak administratorskog ponovnog otvaranja i dovršavanja te studentski prikaz na mobilnoj širini.
- 9 ispitnih integracijskih scenarija prolazi: ovlasti, rokovi, nedolazak, utrka zaključavanja, blokade, otključavanje, povijest i HTTP obrasci.
- 16 ranijih akademskih DB/HTTP scenarija prolazi; regresija prvog i već provedenog uvoza iz simulirane e-Matice te privatnosti agregata generacije prolazi. Izvor simulacije samo je čitan.
- CI konfiguracija je pripremljena; izvršavanje na GitHubu nije pokrenuto. Posebna lint naredba nije konfigurirana.

Praktične upute, kompatibilnost povijesnih podataka i koraci primjene: [docs/POSTUPCI-UPISA-I-ISPITA.md](docs/POSTUPCI-UPISA-I-ISPITA.md). Ne tvrditi da je cijela dostavljena specifikacija dovršena: preostale funkcije su navedene u tablici iznad.

## Iteracija prema 21 izvornom privitku — referada

- Sačuvan naziv ISVU i postojeći računi/upisi. Modul Studentska referada postao je funkcionalan radni prostor za ovlaštene djelatnike ustanove; studenti i nastavnici nemaju pristup referadskim mutacijama.
- Osam vrsta postupka s pripremom, provjerom dokaza, odlukom i atomskom izradom godišnjeg upisnog lista/kolegija. Konačna dovršenost ostaje zaseban kontrolirani postupak.
- Institucionalni matični dosje, zaseban lokalni broj/upisni broj/JMBAG/OIB i službeni godišnji podaci. Student ih čita za sebe; samoprijavljeni podaci nisu službena evidencija prebivališta.
- Uvoz iz vlastite e-Matice dostupan je referadi za vlastite ciljne ustanove/mapiranja. Studentski poziv i jednokratni ispis početnog pristupa dostupni su i bez e-Matice, uz serverski ključ, domene i zaštitu nestudentskih poziva i potvrđenih računa.
- Postojeće studentske evidencije i grupe dostupne su referadi. Autorizacijski kontekst sada izričito čita samo vlastite korisnikove uloge; studentski roster odvojen je od korisnikovih članstava.
- Nova migracija `202611060005_registrar_workbench.sql`: četiri RLS tablice, referadski RPC-ovi, ovlasti uvoza i početnog studentskog pristupa. Instalacija ima 33 RLS tablice. Korisnik je naknadno potvrdio primjenu nove migracije. Slijedi slanje pripremljene verzije na povezanu granu main; završni Vercel status nije potvrđen.
- 45 jediničnih testova, typecheck, build i čista instalacija svih migracija prolaze. Prolazi 16 referadskih integracijskih scenarija, uključujući svih osam vrsta, utrku dvostrukog upisa, ograničene službene podatke, studentski pristup bez e-pošte i Chromium pripremu/odobrenje/izradu upisnog lista te izmjenu godišnjih podataka. Regresija prvog i već provedenog uvoza prolazi.

[Operativne upute](docs/REFERADA.md) · [Inventar 21 privitka, provjereni odjeljci i granice implementacije](docs/ISVU-PRILOZI-REFERADA.md). Evidentiranih 609 stranica/slajdova nije tvrdnja da su svi prikazi ručno pregledani ili sva njihova funkcionalnost izvedena. Verzije nastavnog programa/kalendara, cjelovita financijska knjiga, sva PDS pravila, priznavanje, završetak i službeno pečatiranje i dalje nisu proglašeni dovršenima.

## Domene, centralni portal i fakultetski rasporedi — 9. studenoga 2026.

- Centralni portal na glavnoj domeni `/admin`, Administracija studija na `/admin/studiji`, Administracija sustava na `/admin/sustav`. Produkcijske stare poddomene tih modula preusmjeravaju na nove putanje.
- Referada ostaje zasebno na `referada.isvu.me`. Jedina korisnikova referadska ustanova otvara se automatski; za više ustanova traži se izbor. Nastavnička članstva ne nude se kao referadska ovlast.
- Jedinstvene oznake `url_slug`, početno iz postojeće kratice, služe adresama `raspored.isvu.me/ufzg`, `/geofzg` itd. Oznaka se može urediti u postavkama ustanove i ostaje stabilna pri promjeni naziva.
- Sačuvana oznaka fakulteta pri prijavi, promjeni prikaza i povratku nakon izmjene rasporeda. Ne uvodi se javni pristup privatnim akademskim podacima. Query/Host manipulacije ne prelaze granicu ustanove.
- Dodana migracija `202611090001_institution_routes.sql`; broj aplikacijskih RLS tablica ostaje 33. Nova zadana roditeljska domena u runtime konfiguraciji i `.env.example` je `isvu.me`; Vercel postojeća varijabla mora se uskladiti ručno.
- 48 jediničnih testova i čista instalacija SQL-a prolaze. Šest novih integracijskih scenarija prolazi, uključujući stvarni Chromium tok prijave i fakultetskog rasporeda. Typecheck i webpack build prolaze. Nakon promjene usmjeravanja prolaze i 19 Auth/SSO te 16 akademskih DB/HTTP regresijskih scenarija.
- Korisnik je odobrio slanje ove iteracije na GitHub radi Vercel objave. Javne Vercel/DNS/Supabase Auth postavke agent nije mijenjao; završni status objave i primjena nove migracije nisu ovdje potvrđeni. Točna konfiguracija i granice lokalnog testa: [docs/DOMENE-ISVU.md](docs/DOMENE-ISVU.md).

## Ispravak tipki na produkcijskim domenama — 9. studenoga 2026.

- Ispravljen prioritet razrješavanja hosta: `isvu.me` ostaje vlastita domena i kada je Vercel navede u `VERCEL_PROJECT_PRODUCTION_URL`. Tipke tada koriste `/admin`, `/admin/studiji`, `/admin/sustav` i odgovarajuće poddomene.
- Stare produkcijske `?module=` poveznice i točno dopušteni produkcijski Vercel hostovi preusmjeravaju na nove adrese. Preview i lokalne sesije zadržavaju odvojeni način rada. Proizvoljne Vercel adrese nisu dopuštene.
- Prolazi 50 jediničnih testova, TypeScript provjera i produkcijska webpack izgradnja. Sedam lokalnih HTTP/Chromium scenarija potvrđuje stvarne poveznice na početnoj stranici, produkcijske varijable, preusmjeravanja, prijavu i izolaciju ustanove.
- Nema nove SQL migracije ni promjena DNS-a ili vanjskih Auth postavki. Slanje na GitHub pokreće postojeću Vercel integraciju; dovršetak javne objave nije ovdje potvrđen.

## Pristup Webmailu i stvarni status Merlina — 9. studenoga 2026.

- Webmail tipke koriste `https://isvu.me/webmail`, bez obvezne dodatne poddomene. Ako je stari `webmail` host povezan, preusmjerava na novu putanju. Pristup zadržava provjeru prijave i ovlasti.
- Uklonjena općenita poruka o idućim fazama i neizvedeni Merlinovi izbornici. Prikazuje se stvarni status poštanskog servisa/e-učenja i upute glavnom administratoru.
- Opcionalni `WEBMAIL_LOGIN_URL` i `MERLIN_LMS_URL` daju tipku za vanjsku HTTPS prijavu. To ne stvara sandučiće, LMS sadržaj, SSO ili sinkronizaciju. Čeka se korisnikov odabir vlastitog e-učenja ili postojećeg Moodlea te podatak postoji li poštanski servis.
- Prolazi 51 jedinični test, TypeScript provjera, produkcijska webpack izgradnja i osam lokalnih HTTP/Chromium scenarija. Nema nove SQL migracije. Javna dostupnost DNS-a, vanjskih usluga i dovršetak Vercel objave nisu potvrđeni.
