# Faza 3 — akademski podaci

Implementirani su stvarni portal, Studomat, administracija studija (vlastiti ISVU modul) i raspored. Sve upite filtriraju ustanova, serverska autorizacija i RLS, a međutablični strani ključevi uključuju institution_id.

## Funkcionalni tokovi

1. Administrator/referada u modulu Administracija studija dodaje program, akademsku godinu, semestar i kolegije.
2. U studentskim upisima povezuje postojećeg korisnika s ulogom student s programom i akademskom godinom. Zatim upisuje kolegije istog programa/godine. Student se ne može sam upisati promjenom ID-a.
3. Dodjeljuje korisnika s nastavničkom ulogom kolegiju. Nastavnik može upravljati rokovima i nastavom te ocjenjivati samo svoje kolegije.
4. Dodaje dvorane i grupe te članove grupa među upisanim studentima.
5. U rasporedu unosi termine s hrvatskim vremenom. Datum/vrijeme pretvara se u UTC uz Europe/Zagreb i pravila promjene sata. Preklapanje nastavnika, dvorane ili iste grupe blokira baza, i pri istodobnim zahtjevima. Termini za grupu vidljivi su njenim članovima; zajednički termini svim upisanim studentima.
6. Kreira ispitni rok s kapacitetom i rokovima prijave/odjave. Student u Studomatu prijavljuje/odjavljuje svoje ispite. Baza provjerava upis, rokove, popunjenost i ranije položen kolegij, uz transakcijsko zaključavanje.
7. Nakon održanog ispita nastavnik u Studomatu → Ocjenjivanje upisuje ocjenu i povratnu informaciju prijavljenom studentu. Ocjene imaju raspon 1–5. Svaki ispit čuva vlastiti rezultat; korekcija rezultata ostaje zabilježena u administrativnom zapisniku (metapodaci radnje, bez sadržaja ocjene).
8. Student vidi ocjene i ECTS samo svojih položених kolegija, jednom po šifri, uključujući povijest ispita. Položeni kolegij automatski odjavljuje buduće prijave na isti kolegij. ECTS/šifra/program/semestar upisanog kolegija zaštićeni su od promjena koje bi izmijenile povijest.
9. Portal prikazuje podatke prema ulozi, obavijesti, sljedeće termine i statistiku. Postoji izbor ustanove za višestruka članstva. Nastavnik vidi svoje kolegije i upisane studente, a student svoj studij i bodove.

Obrasci podržavaju dodavanje i uređivanje, uz jasnu potvrdu ili prikaz greške. Kataloške zapise s povijesnim vezama nije predviđeno proizvoljno brisati kroz UI. Akademske promjene zapisuje audit trigger. Podaci se učitavaju u stranicama iz API-ja; prikaze i dalje treba dodatno prilagoditi prije vrlo velikih institucionalnih instalacija (pretraživanje i UI paginacija).

LMS materijali/zadaci/kvizovi, pošta i zahtjevi referade ostaju sljedeće faze. Nema automatskog spajanja sa službenim ISVU-om, Merlinom ili fakultetskom poštom. Raspored provjerava preklapanja termina nastave; ispitni rok ima početak bez modela punog trajanja ispita.

## Baza

Za postojeći projekt s fazom 2 primijeniti samo `supabase/migrations/202610300002_academic.sql`.

Za novi Supabase projekt `supabase/setup.sql` sadrži obje migracije u jednoj transakciji. Pokreće se jednom. Ne uključuje testne podatke, početne korisnike ni tajne. Generira se naredbom `npm run db:bundle`.

Ne pokretati cjelokupni installer na već instaliranom projektu; za nadogradnju služe pojedinačne migracije ili Supabase CLI migracijski tok. Ako je migracija primijenjena ručno kroz SQL Editor, prije budućeg `supabase db push` uskladiti CLI migracijsku povijest prema Supabase uputama.

## Lokalna demonstracija

```sh
npm ci
npm run db:test:start
npm run db:test:migrate
# Samo ako lokalni računi još ne postoje; rotira lokalne testne lozinke:
npm run db:seed-users
npm run db:seed-academic
npm run build
npm start -- --port 3003
# drugi terminal:
AUTH_TEST_PORT=3003 npm run test:academic
AUTH_TEST_PORT=3003 npm run test:integration
npm run test:migrations
npm test
npm run typecheck
```

Koristite račune iz ignorirane lokalne datoteke prema uputama faze 2. Testni programi i studenti nalaze se isključivo u lokalnoj testnoj bazi. Testovi mijenjaju poznate lokalne fixture zapise; ne pokretati ih na produkciji. Cloud može sačuvati datoteke bez živih procesa; lokalni gateway/kontejneri i aplikacija moraju se ponovno pokrenuti.

Testovi provjeravaju izolaciju ustanova, serverske i DB uloge, FK integritet, upise, poziv RPC-ja bez ovlasti, rokove i kapacitet ispita pri istodobnim prijavama, ocjenjivanje, zaštitu povijesnog ECTS-a, preklapanje nastave pri istodobnim unosima te stvarne HTTP obrasce. Posebno se provjerava instalacija na čistoj PostgreSQL bazi s pravom Auth shemom i RLS na svih 21 aplikacijskih tablica. HTTP testovi ne zamjenjuju browser provjeru produkcijskog SSO-a.


## Akademsko upravljanje glavnog administratora

Glavni administrator može iz **Administracija sustava** izravno otvoriti Studijske programe, Akademske godine (uključujući semestre), Kolegije (nastavnike i grupe), Studente i upise, Dvorane, Ispitne rokove, Upravljanje terminima i Obavijesti. U svakom odjeljku bira ustanovu; obrasci nakon spremanja ostaju u istom administratorskom odjeljku i ustanovi. Glavnom administratoru nije potrebno dodatno članstvo da bi upravljao ustanovom.

Uz ustanovu je poveznica **Upravljaj kolegijima i studijem**, koja otvara upravo njezine podatke. Administrator ustanove i dalje koristi **Administraciju studija**, s pravima samo u vlastitoj ustanovi. Za prvi kolegij redom kreirajte studijski program, akademsku godinu i semestar, pa odaberite **Kolegiji → Novi zapis**. Poveznice ne daju nove ovlasti studentima ni nastavnicima; serverske i RLS provjere ostaju aktivne.

Lokalni regresijski test: uz pripremljenu bazu i izgrađenu aplikaciju na portu 3005 pokrenite `node scripts/test-admin-academic.mjs` (ili postavite `AUTH_TEST_PORT`). Provjerava glavnog administratora bez članstava, sve akademske administratorske odjeljke i stvarno stvaranje programa, godine, semestra, kolegija i dvorane. Testne zapise uklanja nakon provjere.
