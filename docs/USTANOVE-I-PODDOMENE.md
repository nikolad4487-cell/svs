# Ustanove i njihove poddomene

## Stvarno stanje 11. 11. 2026.

Postojeća aplikacija proširena je katalogom 125 ustanova, javnim pregledom na početnoj stranici, institucionalnim početnim stranicama i superadministratorskim uređivanjem. Lokalna baza sadrži svih 125 zapisa. Produkcijski projekt `wjxmyxxwqspwswfwjpdn` pri provjeri nema novu migraciju; produkcijska baza nije promijenjena. Projekt e-Matice/e-Dnevnika nije cilj ovog uvoza.

[Izvještaj za svih 125 ustanova, kolizije i neprovedeni koraci](../reports/visoka-ucilista-125.md). Sedam web-adresa dolazi isključivo iz korisnikovih primjera; 118 adresa nije dostupno. Nijedna adresa nije potvrđena dohvatom službenog registra. Sve dodijeljene poddomene imaju `requires_verification`. Službeni identifikatori svih 125 ustanova zasad su prazni. Privremeni `hr-isvu-125:NNN` i deterministički UUID nisu službeni ISVU identifikatori.

Izvorni PDF ima šest slikovnih stranica. Nazivi, nadređene ustanove i sjedišta usklađeni su s korisnikovim popisom i OCR-om PDF-a. Provjerljiv izvor i SHA-256 dokumenta nalaze se u `data/institutions/provenance.json`. U PDF-u nema strojno čitljivih pojedinačnih poveznica ili službenih identifikatora. Potvrđene nedostajuće podatke treba dohvatiti iz službenih zapisa; nisu izmišljeni.

## Postojeći podaci i izolacija

Koristi se postojeća tablica `institutions`, postojeća članstva, uloge, akademske evidencije i RLS. Nije stvoren paralelni model korisnika. Nova ustanova ne dobiva studente, korisničke račune, stvarne adrese studenata ni dopuštene e-mail domene. Polje službene internetske adrese nije pravilo registracije. Nadređeno sveučilište predstavlja podatak iz registra i ne daje pristup članicama.

Izričito mapiranje u `data/institutions/legacy-bindings.json` povezuje postojeći UFZG s odgovarajućim zapisom iz kataloga. Provjeravaju se postojeći UUID, kod, sjedište i ruta. Čuvaju se UUID, postojeći naziv, kod, aktivnost, e-mail domene, članovi i akademske evidencije; dodaju se registracijski metapodaci. Ako taj zapis ne postoji u praznoj instalaciji, nastaje novi zapis kataloga. Ustanove se nikad ne spajaju samo po nazivu.

Anonimni direktorij vraća izričito odabrane javne metapodatke aktivnih ustanova. Ne izlaže članstva, studente ili domene za prijavu. Promjena UUID-a u URL-u ne daje ovlasti. Upiti privatnim podacima i dalje prolaze provjere uloga i RLS. Poslužitelj nakon prijave provjerava članstvo u odabranoj ustanovi. Neovlaštena osoba dobiva odbijen pristup; poddomena joj ne stvara članstvo.

## Usmjeravanje i prijava

`fer.isvu.me`, `fhs.isvu.me` i `vuka.isvu.me` otvaraju javne institucionalne stranice nakon primjene migracija i DNS postavki. Naziv, sjedište, sveučilište i eventualni službeni kontakti dolaze iz baze. Nepostojeća, neispravna ili deaktivirana oznaka vraća 404. Zaglavlja s navodnim identitetom ustanove zamjenjuje poslužitelj podatkom iz baze. Promjene u bazi vidljive su bez ponovnog deploymenta.

Institucionalna poddomena prikazuje početnu stranicu ustanove; prijava i privatni moduli koriste postojeće tehničke domene (`auth`, `referada`, `studomat`, `merlin`, `issp`, centralni portal). Poveznice nose provjereni `institution` UUID. Privatni API i alternativne putanje na institucionalnom hostu vraćaju 404. Tako ostaju sačuvani postojeći moduli i njihove provjere prava. Merlin dodatno filtrira pregled kolegija prema odabranoj ustanovi. Ovo ne premješta sve postojeće module pod svaku školsku poddomenu.

U produkciji postojeća sigurna sesija koristi `Secure`, `HttpOnly` kolačiće za `.isvu.me`. Sve poddomene te zone moraju biti pod nadzorom vlasnika aplikacije; ne smiju se delegirati proizvoljnim korisnicima. Razvojni prikaz na localhostu ne dokazuje javni HTTPS ili produkcijski SSO.

## Migracije i uvoz

U SQL Editoru odgovarajućeg **ISVU** projekta primijeniti redom:

1. `supabase/migrations/202611110002_institution_tenants.sql` — stupci, provjere, zaštita metapodataka i funkcije.
2. `supabase/migrations/202611110003_institution_catalog_125.sql` — izvorni transakcijski uvoz 125 zapisa i pregledano mapiranje UFZG-a.
3. `supabase/migrations/202611110004_institution_short_labels.sql` — ispravak prethodno generiranih dugih oznaka u kratice. Ako su 002 i 003 već primijenjene, primijeniti samo 004; ne ponavljati migraciju koja dodaje stupce.

Postojeće ranije migracije moraju biti primijenjene; ove datoteke ne instaliraju cijelu praznu bazu. Za novu lokalnu bazu postoji generirani `supabase/setup.sql`. SQL paketi za ručno kopiranje imaju `begin`/`commit`; ako nastane konflikt, transakcija se mora poništiti, a uzrok pregledati, bez brisanja postojećih ustanova.

```sh
npm run catalog:build
npm run catalog:import                 # lokalni pregled bez upisa
npm run catalog:import -- --apply      # lokalni uvoz
npm run catalog:import -- --production # produkcijski pregled bez upisa
```

Produkcijski upis putem skripte zahtijeva dodatni `--apply`, prethodnu migraciju i već konfigurirane serverske `SVS_SUPABASE_URL` / `SVS_SUPABASE_SECRET_KEY`. Skripta ograničava cilj na postojeći ISVU projekt. Ključ se ne upisuje u klijentski kod ili repozitorij i ne šalje u razgovor. Izvorni seed SQL poziva istu funkciju; zatim 004 ispravlja automatske duge oznake. Dodatni import nije potreban nakon primjene svih triju migracija.

Ponovljeni uvoz ne stvara duplikate. Prioritet imaju stabilni ključ izvora, zatim službeni ID i izričita pregledana veza s postojećim zapisom. Novi izvorni podaci ne mijenjaju već dodijeljenu poddomenu ni staru rutu rasporeda. `registry_metadata_locked` štiti administratorske odluke; source snapshot ostaje dostupan za usporedbu. Superadministrator uređuje katalog u Administraciji sustava; postojeće upravljanje pozivima i ulogama ustanove ostaje dostupno. Administrator pojedine ustanove nema pravo mijenjati globalni registar.

## Dopuna iz službenog izvora

Mrežna politika ovog okruženja vraća HTTP CONNECT 403 za `www.isvu.hr`. U spremljeni mrežni nacrt dodani su `www.isvu.hr` i `isvu.hr`; nacrt treba pregledati i objaviti u postavkama okruženja da bi stupio na snagu. Objavljivanje aplikacije nije objavljivanje mrežnih pravila okruženja.

Nakon dopuštenog pristupa:

```sh
npm run catalog:collect
# Ako je popis iscrtan JavaScriptom: spremiti njegov službeni prikaz kao HTML.
npm run catalog:collect -- --list-html /putanja/sluzbeni-popis.html
npm run catalog:build
```

Kolektor samo čita službeni registar. Zahtijeva 125 nedvosmislenih poveznica prije zamjene enrichment datoteke; neuspjeh čuva postojeću datoteku. Oslanja se na tablične zapise i oznake polja te ga treba provjeriti na stvarnom HTML-u kad postane dostupan. Provjereni sadržaj i izvorni identifikatori moraju se pregledati prije ponovnog uvoza. Naknadno generirani prijedlog poddomene ne preimenuje automatski već uvezeni hostname; promjenu provodi superadministrator. `registry_reported` znači da URL navodi službeni registar, ne da je aplikacijski DNS potvrđen.

## Vercel, DNS i HTTPS — ručno, još neprovedeno

1. Otvoriti postojeći Vercel projekt aplikacije, **Settings → Domains**. Zadržati `isvu.me` i sve postojeće tehničke domene. Dodati `*.isvu.me` istom projektu. Ne stvarati zasebnih 125 projekata ili deploymenta.
2. Slijediti stvarne vrijednosti i postupak koje prikaže Vercel za taj projekt. Wildcard certifikat obično zahtijeva Vercel DNS i njegove nameservere; pojedinačni wildcard CNAME ne dokazuje da je certifikat izdan. Ako Vercel zahtijeva promjenu nameservera, prije nje preslikati postojeće DNS zapise, posebno Zoho MX, SPF, DKIM i TXT provjere, kako bi pošta ostala dostupna.
3. Kod registra domene (npr. Namecheap) dodati upravo zatražene zapise ili nameservere. Univerzalna IP adresa ili CNAME odredište nisu upisani u ove upute jer ovise o konfiguraciji projekta. Postojeći specifični poddomenski zapisi imaju prednost pred wildcardom; provjeriti da školske oznake ne vode na drugi projekt.
4. U Vercelu pričekati valjanu konfiguraciju i HTTPS certifikat za apex i wildcard. U Supabase Authentication postavkama zadržati postojeće sigurno odredište `auth.isvu.me` i postojeće callback putanje; institucionalni javni hostovi nisu novi proizvoljni callbackovi.
5. Javno ispitati `https://fer.isvu.me`, `https://fhs.isvu.me`, `https://vuka.isvu.me`, prijavu i nepoznatu poddomenu. Provjeriti HTTPS i sesiju kroz stvarne tehničke module. Ovaj korak nije proveden iz lokalnih testova.

Tehničke oznake iz `src/lib/institutions/domains.ts` i SQL provjere rezervirane su, uključujući postojeće `studomat`, `referada`, `raspored`, `merlin`, `auth`, `issp` i `mail`. Aplikacija jasno navodi da je neovisan projekt; ne tvrdi pripadnost državnom ISVU-u ili pojedinim ustanovama.

## Provjere

`npm test`, `npm run typecheck`, `npm run build -- --webpack`, `npm run test:migrations`, `npm run test:institution-tenants`. Posljednja provjera koristi isključivo lokalnu testnu bazu i privremene članove/evidencije te vraća izmijenjene metapodatke. Za preglednik postaviti `WORKFLOW_PLAYWRIGHT_MODULE` na instalirani Playwright modul. Testovi uključuju ponovljeni uvoz, čuvanje postojećeg UFZG-a, zasebne istoimene ustanove, RLS preko drugih ustanova, zabranu uređivanja metapodataka običnom administratoru, lažirana zaglavlja i URL-ove, FER/FHS/VUKA, nepoznatu poddomenu, administratorsko uređivanje i dinamičku deaktivaciju.

Javni DNS, produkcijske migracije i dohvat živog registra nisu zamijenjeni ovim testovima.


## Ispravak kratica prema korisnikovoj dopuni

Poddomene se sada temelje na početnim slovima riječi, npr. **Fakultet elektrotehnike, računarstva i informacijskih tehnologija Osijek → ferito.isvu.me**. Izostavljaju se veznici i prijedlozi `i`, `u`, `za`, `na`, `s`, `sa`, `te`, `od`, `iz`; oznaka pravnog statusa „bez pravne osobnosti” ne ulazi u kraticu. Primjeri su još `adu`, `alu`, `fkit`. Ranije izričito zatražene oznake `fer`, `fhs`, `foi`, `efzg`, `uniri`, `unizg`, `vuka`, `ufzg` i `geofzg` zadržane su kao iznimke. Za iste kratice dodana je oznaka grada, a po potrebi razlikovna riječ (`ef-ri`, `ef-st`, `af-zg-agro`, `af-zg-arhi`). Svih 125 oznaka je jedinstveno i imaju najviše 11 znakova. To su oznake ove aplikacije, a ne tvrdnja o službenim kraticama ili provjerenim web-adresama.

Migracija 004 mijenja samo prepoznate automatski dodijeljene duge oznake iz prethodne verzije. UUID, korisnici, upisi i sve nastavne evidencije ostaju isti. Ranije ručno promijenjene ili zaključane oznake ostaju sačuvane. Ponovljena primjena nema dodatnih učinaka. Stara migracija 003 nije prepisana: nova instalacija prvo uvozi izvorni snapshot, zatim 004 ispravlja oznake. Aktualni JSON katalog i izvještaji već sadrže kratice. Ako korisnik kasnije uređuje naziv ustanove ili se promijeni web-adresa, postojeća poddomena se i dalje ne preimenuje automatski.
