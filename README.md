# ISVU · Informacijski sustav visokih ustanova

Modularna hrvatska platforma visokog obrazovanja: Next.js 16 App Router, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide i Supabase Auth/PostgreSQL. Kompatibilna s Vercelom.

## Implementirano

**Faza 1:** glavna stranica, devet zasebnih modula, sigurno usmjeravanje po Host zaglavlju, lokalni hostnameovi i fallback, navigacija, responzivni dizajn, svijetli/tamni način, loading/error/404.

**Faza 2:** serverska prijava, registracija po pozivu, potvrda e-pošte, reset/promjena lozinke, SSO kolačići za vlastitu roditeljsku domenu, upravljanje i opoziv sesija, profili, ustanove, višestruka članstva/uloge, administrativni zapisnik i RLS. Detaljne upute i sigurnosni preduvjeti: [docs/FAZA-2.md](docs/FAZA-2.md).

**Faza 3:** funkcionalni portal prema ulozi, studijski programi/godine/semestri, upisi i kolegiji, dodjela nastavnika, ispitni rokovi i prijave/odjave, ocjenjivanje i ECTS, grupe, dvorane, tjedni/mjesečni raspored i obavijesti. [Tehničke upute faze 3](docs/FAZA-3.md).

LMS i poslovni zahtjevi referade slijede u idućim fazama. Modul e-učenja nije službeni Merlin/Moodle, a administracija studija nije službeni ISVU. Nema lažne e-pošte: pružatelj još nije povezan. Bez Supabase konfiguracije prikazuje se objašnjenje, a ne lažna prijava.

## Pokretanje

Node.js 24 i npm:

```sh
npm ci
cp .env.example .env.local
# unesite konfiguraciju prema docs/FAZA-2.md ili koristite lokalni testni profil
npm run dev
```

Glavna domena: `localhost:3000`. Moduli: `portal`, `studomat`, `merlin`, `webmail`, `isvu`, `referada`, `raspored`, `auth`, `admin` kao `<modul>.localhost:3000`. Za preglednike bez wildcard localhosta koristite `localhost:3000/?module=studomat`. Na korijenskom localhostu navigacija koristi query fallback kako bi host-only sesija ostala dostupna svim modulima.

Za provjereni lakši lokalni testni sustav s Dockerom koristite `npm run db:test:start`, zatim `npm run db:seed-users`; time nastaje lokalna konfiguracija bez vanjskog računa. Nemojte prije toga kopirati prazan `.env.local`, jer skripta čuva postojeće datoteke.

Za SSO preko lokalnih poddomena postavite `LOCAL_BASE_DOMAIN=svs.test` i dodajte pojedinačne hostnameove u hosts datoteku prema uputama za fazu 2. Hosts datoteka ne podržava wildcard. Nepoznati hostovi i izravan pristup internim `/sites/*` rutama daju 404. Proizvoljni `*.vercel.app` hostovi nisu dopušteni.

```sh
npm test
npm run build
npm run typecheck
npm start
# bez konfiguriranog Supabasea (smoke test osnovnog routinga):
npm run test:smoke
# s lokalnom testnom bazom i serverom na portu 3002:
AUTH_TEST_PORT=3002 npm run test:integration
```

Testovi Auth/SSO-a koriste stvarne Supabase Auth/PostgREST servise, provjeru uloga i RLS na PostgreSQL-u. HTTP testovi ne zamjenjuju pregledničku provjeru kolačića na konačnoj HTTPS domeni.

## Arhitektura

- `src/proxy.ts`: whitelist hostnameova, interne rute, centralna CSRF provjera API mutacija i osvježavanje sesija.
- `src/lib/hosts.ts`, `modules.ts`: odobreni moduli i sigurni URL-ovi.
- `src/lib/supabase`: serverski klijent i proxy refresh; nema browser spremanja tokena.
- `src/lib/auth`: autorizacija, request kontekst i HttpOnly/Secure cookie politika.
- `src/app/api`: stvarni Auth, profil/session i institucionalni API endpointi, uz serverske provjere.
- `src/components/auth`: obrasci, sesije, ustanove i dodjela uloga.
- `supabase/migrations`: relacijski model, indeksi, triggeri, Auth hook i RLS.

## Vercel

Uvezite GitHub repozitorij `nikolad4487-cell/svs`, grana `main`. `vercel.json` određuje framework, `npm ci` i `npm run build`. U Environment Variables postavite Supabase URL i javni publishable ključ prema `.env.example`; service-role ključ nije potreban aplikaciji. Nakon migracije i uključivanja Auth hooka uključite pozvanu registraciju. Ponovno objavite nakon promjene varijabli.

[Uvezi projekt u Vercel](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2Fnikolad4487-cell%2Fsvs)

Vercelove točne platformom zadane adrese (`VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, uz `VERCEL=1`) automatski se prihvaćaju. Na njima moduli koriste HTTPS i `?module=`, uz host-only sesiju. Ne postavlja se cookie za javni sufiks `.vercel.app`.

## Vlastita domena i HTTPS

1. Postavite `BASE_DOMAIN=domena.hr` bez protokola, porta ili putanje.
2. U Vercel Domains dodajte glavnu domenu, `www` i svaku poddomenu, ili glavnu domenu i `*.domena.hr`.
3. Unesite konkretne DNS zapise koje Vercel prikaže. Za wildcard certifikat slijedite Vercelove zahtjeve, u pravilu delegaciju nameservera. Ako delegacija nije moguća, dodajte pojedinačne poddomene.
4. Sve domene moraju pripadati istom Vercel projektu. Vercel omogućuje HTTPS nakon provjere DNS-a. Aplikacija ne registrira domene i ne mijenja DNS.
5. U Supabaseu postavite Auth Site URL, točne callback adrese i e-mail predloške prema [uputama](docs/FAZA-2.md).

Pri promjeni domene ažurirajte DNS/TLS, `BASE_DOMAIN`, Auth redirect adrese i e-mail predloške; korisnici će se ponovno prijaviti. Sve poddomene moraju biti pod vašom kontrolom jer dijele cookie roditeljske domene.

Objava, konfiguracija produkcijskog Supabasea i SMTP zahtijevaju pristup vašim računima. Prolazak lokalnih provjera ne znači da su vanjske usluge povezane ili produkcija objavljena.

Za novi Supabase projekt pokrenite jednom `supabase/setup.sql` u SQL Editoru. Za već instaliranu fazu 2 koristite samo `supabase/migrations/202610300002_academic.sql`. Gotova javna adresa korisnika: https://svs-zeta-three.vercel.app; Supabase callback: https://svs-zeta-three.vercel.app/api/auth/callback.
