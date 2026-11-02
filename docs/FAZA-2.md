# Faza 2: identitet, ustanove i Supabase

## Implementirano

- Supabase Auth e-mail/lozinka, prijava, pozvana registracija i potvrda adrese, oporavak/promjena lozinke.
- Serverski Supabase klijent bez browser klijenta; HttpOnly kolačići, Secure na produkciji, SameSite=Lax. Proxy obnavlja tokene i zabranjuje cache personaliziranih odgovora.
- Centralna prijava na `auth` i povratak samo na poznati modul. Proizvoljni redirect URL se ne prihvaća.
- Jedna osoba može imati više uloga u više ustanova. Superadministratori su posebna SQL-only tablica, nikad korisnički metadata.
- SQL migracija, strani ključevi, jedinstvenost, indeksi, RLS svih javnih tablica. RLS i serverski kod provjeravaju aktivnu Auth sesiju, a ne samo potpis JWT-a.
- Profil, stvarni popis Auth sesija i opoziv pojedine/svih sesija. Odjava odmah oduzima pristup podacima preko aplikacije i RLS-a, čak i uz ranije izdani JWT.
- Superadministrator dodaje/uređuje ustanove i dodjeljuje/uklanja institucionalne uloge. Administrator ustanove uređuje svoju ustanovu i poziva studente, nastavnike i referadu. Poziv vrijedi 7 dana; obrazac ga sprema, ne šalje e-poštu.
- Pozvani korisnik registrira se putem auth modula; novi poziv već potvrđenog korisnika prihvaća se pri idućoj prijavi.
- Administrativni zapisnik prati promjene ustanova, članstava, poziva i SQL dodjelu superadministratora, bez lozinki i tokena.
- Studijske evidencije, LMS, raspored i poslovanje referade nisu dio ove faze. Njihove stranice sada zahtijevaju aktivno članstvo; ISVU dodatno zahtijeva administratorsku ili referadsku ulogu, a admin superadministratora.

## Lokalni Supabase

Potrebni su Docker i Node.js 24. Prva naredba preuzima službene Supabase slike i može trajati nekoliko minuta.

```sh
npm ci
npm run db:start
# SAMO lokalna testna baza: reset briše postojeće lokalne podatke!
npm run db:reset
npm run db:seed-users
npm run dev -- --port 3002
# drugi terminal
AUTH_TEST_PORT=3002 npm run test:integration
```

`db:seed-users` dopušta samo loopback Supabase, priprema 2 testne ustanove i 6 testnih računa: superadmin, administrator, referada, nastavnik i dva studenta u odvojenim ustanovama. Lozinke se nasumično generiraju pri svakom izvršenju i nalaze se isključivo u ignoriranom `.local-test-users.json` s dozvolama 0600. Ne ispisuju se u log ni ne spremaju u Git. Skripta priprema lokalni `.env.local` i odbija prepisati ručno izrađen postojeći `.env.local`.

Testni modul ustanove odabire se preko članstava; korisnik ne može promjenom ID-a dobiti tuđe podatke. Prvi superadministrator nastaje kontroliranim lokalnim SQL bootstrapom. Produkcija nema zadani račun niti zadanu lozinku.

Za lokalni SSO preko poddomena koristite `LOCAL_BASE_DOMAIN=svs.test` i u hosts datoteku dodajte:

```text
127.0.0.1 svs.test auth.svs.test portal.svs.test studomat.svs.test merlin.svs.test webmail.svs.test isvu.svs.test referada.svs.test raspored.svs.test admin.svs.test
```

Zatim otvorite `http://auth.svs.test:3002`. Preglednici nedosljedno podržavaju roditeljski cookie na `localhost`, stoga su na localhostu sigurni host-only kolačići. Pristup preko `localhost:3002/?module=auth` koristi jedan hostname i zadržava sve module kroz query parametar. Pojedinačne `*.localhost` adrese i dalje se usmjeravaju, ali za pouzdan SSO među njima koristite navedenu `.test` domenu. Testni HTTP program šalje Host zaglavlja i ne zahtijeva promjenu DNS-a; ne zamjenjuje pregledničko testiranje cookie pravila.

Lokalni mailpit hvata potvrdne i reset poruke; adresu dobijete naredbom `npx supabase status`. Za link koji radi i iz drugog preglednika koristite Supabase e-mail predloške iz idućeg odjeljka.

`npm run db:stop` zaustavlja lokalni sustav uz zadržavanje baze. `db:reset` nije naredba za svakodnevni startup.

### Lakši testni profil za ograničeno cloud okruženje

U ovom okruženju puna službena PostgreSQL slika premašila je raspoloživ disk. Provjeren je sljedeći zaseban profil:

```sh
npm run db:test:start
npm run db:seed-users
npm run dev -- --port 3002
# drugi terminal:
AUTH_TEST_PORT=3002 npm run test:integration
```

Profil koristi službene Supabase Auth i PostgREST slike, PostgreSQL 17 Alpine, mailpit i lokalni HTTP gateway, vezane isključivo na loopback portove. Nije puna Supabase CLI instalacija i nema Storage, Studio ili Realtime. Službene Auth migracije kreiraju auth tablice; naše javne migracije i RLS primjenjuju se bez izmjene. Ovaj profil nikad nije produkcijska konfiguracija.

`db:test:stop` zaustavlja njegove kontejnere, a `db:test:start` ih nastavlja bez brisanja podataka. Djelomično postojeći profil skripta čuva i traži ručnu dijagnostiku. Ne pokrećite ga paralelno s punim Supabase CLI stackom jer dijele portove. `.local-*.json` i `.local-*.env` datoteke s nasumičnim lokalnim ključevima i lozinkama ignorirane su u Gitu i imaju dozvole 0600. Te datoteke i Docker volumen potrebni su zajedno za nastavak rada. Ako cloud snapshot ne zadržava Docker podatke, njihova obnova nije automatski zajamčena.

## Produkcijski Supabase i Vercel

1. U svojem Supabase računu stvorite zaseban projekt, odaberite EU regiju i pripremite sigurnosne kopije prema pravilima ustanove.
   Za pristup udaljenom projektu iz ograničenog cloud okruženja potrebno je dopustiti njegov točan `<project-ref>.supabase.co` hostname u mrežnim postavkama. Vercel ima vlastitu konfiguraciju mrežnog pristupa.

2. Primijenite `supabase/migrations/202610300001_identity.sql` pomoću Supabase CLI migracija (`supabase link`, zatim `supabase db push`) ili SQL Editora. **Ne izvršavajte lokalni seed/fixture skripte u produkciji.**
3. U Auth → Hooks uključite **Before User Created** i odaberite `public.before_user_created`. Ovo je obavezan dio sigurnosti: aplikacijski obrazac sam ne može spriječiti izravan poziv Supabase Auth API-ju. Ako hook nije uključen, zadržite javnu registraciju isključenom. Lokalni config uključuje hook automatski.
4. Auth mora zahtijevati potvrdu e-adrese; minimalna lozinka 12 znakova. Podesite vlastiti SMTP i ograničenja zahtjeva/CAPTCHA u Supabaseu prema potrebama ustanove. Aplikacija se oslanja na Auth rate limiting; nema distribuirani aplikacijski rate limiter.
5. U Vercel postavke dodajte `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` iz Project Settings → API. Dopušten je i stari javni anon ključ pod `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Nikad ne koristite service-role ključ kao publishable/anon ključ.** Aplikacija ne koristi service-role ključ u runtimeu.
6. `AUTH_INVITE_SIGNUP_ENABLED=true` postavite tek nakon provjere hooka i potvrde adrese. `BASE_DOMAIN` postavite za svoju domenu; na zadanoj Vercel domeni nije potreban. Ponovno objavite projekt nakon promjene environment variables.
7. Auth Site URL postavite na `https://auth.VASA-DOMENA`. Dopuštene redirect adrese: točno `https://auth.VASA-DOMENA/api/auth/callback`. Na Vercel domeni bez vlastitog DNS-a koristite `https://VAŠ-PROJEKT.vercel.app/api/auth/callback`. Dodajte samo konkretne pouzdane preview adrese kada ih trebate, bez općeg wildcarda za tuđe projekte.
8. Za potvrdu registracije preporučen je e-mail predložak koji sadrži `https://auth.VASA-DOMENA/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. Za reset lozinke zamijenite `type=signup` s `type=recovery`. Na Vercelu koristite istu Vercel domenu umjesto auth poddomene. Standardni Supabase PKCE `ConfirmationURL` radi kroz `/api/auth/callback` u izvornom pregledniku; token_hash predložak podržava i drugi preglednik.
9. Bootstrap prve ustanove i superadministratora napravite kontroliranim SQL postupkom ispod. Zatim se prijavite i nastavite kroz UI.

```sql
-- Zamijenite stvarnim podacima, bez lozinki u SQL-u.
insert into public.institutions(name,code) values ('Naziv visokog učilišta','KRATICA');
-- ID prethodno kreirane ustanove:
insert into public.registration_invites(institution_id,email,role)
values ('UUID-USTANOVE','administrator@ustanova.hr','institution_admin');
-- Korisnik se sada sam registrira i potvrdi e-poštu. Tek nakon provjere njegova identiteta:
insert into public.superadmins(user_id)
select id from auth.users where lower(email)='administrator@ustanova.hr' and email_confirmed_at is not null;
```

Nemojte dodjeljivati superadministratora prema `raw_user_meta_data`, domeni e-pošte ili prvom korisniku. Pristup SQL Editoru i Supabase administratorskim ključevima je privilegiran izvan aplikacije.

## Sesije i granice povjerenja

Na vlastitoj domeni cookie `svs-auth` (po potrebi podijeljen u chunkove) vrijedi za `.BASE_DOMAIN`, s path `/`. Sve poddomene moraju biti pouzdane i pod vašom kontrolom. Na Vercelovim domenama nema cookie dijeljenja javnog sufiksa `.vercel.app`; svi moduli rade na jednom točno dopuštenom hostnameu preko `?module=`.

Svi POST endpointi provjeravaju točan Origin (uključujući poddomenu, protokol i port). GET endpointi ne mijenjaju poslovne podatke; iznimka su namjenski e-mail Auth callback/confirm endpointi s jednokratnim PKCE kodom ili token_hash. Nepostojeće/neaktivne sesije ne daju prava čak i ako napadač ima raniji token. Aplikacija nikad ne autorizira samo iz `getSession()` ili skrivanja gumba.

Ako mijenjate domenu, promijenite DNS/TLS, `BASE_DOMAIN`, Supabase Site URL/redirectove i e-mail predloške te ponovno objavite aplikaciju. Stari cookie neće vrijediti na novoj domeni; korisnici se trebaju ponovno prijaviti.

Provjera prije produkcije: stvarni SMTP i isporuka poruka, browser SSO i cookie pravila na konačnom HTTPS DNS-u, produkcijski RLS i politika privatnosti/zadržavanja podataka. Lokalna provjera nije potvrda da je vanjski projekt konfiguriran ili da je aplikacija objavljena.

## Dopuštene domene e-pošte po ustanovi

U administraciji sustava ili u upravljanju vlastitom ustanovom unesite **Dopuštene domene e-pošte**. Podržano je do 20 domena odvojenih zarezom, razmakom ili točkom-zarezom. Unosi se samo hostname, bez `@`, protokola ili wildcarda; velika slova se normaliziraju. Internacionalne domene unesite u punycode obliku. Poddomene dodajte zasebno. Nema unaprijed ugrađenih stvarnih fakultetskih domena.

Registracija zahtijeva adresu s dopuštene domene, neistekli administratorski poziv za tu adresu i potvrdu e-pošte. Sama domena ne dodjeljuje članstvo ni ulogu. Provjera se izvršava i u bazi pri stvaranju poziva, u Auth hooku, pri potvrdi adrese te pri prihvaćanju naknadnog poziva. Članstvo za pojedinu ustanovu ne aktivira se ako je njena domena u međuvremenu uklonjena. Promjena domene ne opoziva postojeća članstva; opoziv je zasebna administratorska radnja.

**Nadogradnja postojećeg projekta:** primijenite `supabase/migrations/202611020001_email_domains.sql` nakon prethodnih migracija, zatim unesite domene za svaku ustanovu. Migracija namjerno ostavlja prazne popise: do konfiguracije novi pozivi i registracije su blokirani, a postojeći korisnici zadržavaju članstva. Ne pokrećite cijeli `setup.sql` na postojećoj bazi. Za novi projekt regenerirani `supabase/setup.sql` već sadrži ovu migraciju. Auth hook `public.before_user_created` i dalje mora biti uključen; njegova se funkcija nadograđuje bez promjene naziva.

Domene za prijavu nisu DNS domene na kojima se aplikacija poslužuje i ne mijenjaju `BASE_DOMAIN` ni Vercel postavke. Ove postavke same ne stvaraju poštanske sandučiće.

Lokalne demo ustanove u `supabase/seed.sql` izričito koriste `example.test`. Za nadogradnju već postojeće lokalne demo baze postavite tu domenu samo tim testnim ustanovama prije integracijskih testova. Dodatna provjera novih pravila: `node scripts/test-email-domains.mjs`; test radi u transakciji i na kraju vraća sve svoje promjene.
