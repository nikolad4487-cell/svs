# Domene i raspored po ustanovi

## Adrese

| Dio aplikacije | Kanonska adresa |
| --- | --- |
| Centralni portal | `https://isvu.me/admin` |
| Administracija studija | `https://isvu.me/admin/studiji` |
| Administracija sustava | `https://isvu.me/admin/sustav` |
| Studomat | `https://studomat.isvu.me` |
| Referada | `https://referada.isvu.me` |
| E-učenje | `https://merlin.isvu.me` |
| Raspored | `https://raspored.isvu.me` |
| Raspored Učiteljskog fakulteta | `https://raspored.isvu.me/ufzg` |
| Raspored Geodetskog fakulteta | `https://raspored.isvu.me/geofzg` |
| Prijava | `https://auth.isvu.me` |
| Pristup pošti | `https://isvu.me/webmail` |

Portal na `/admin` dostupan je prijavljenom korisniku prema njegovim ovlastima. Administracija sustava i dalje je samo za glavnoga administratora, a administracija studija za odgovarajuće osoblje. Sam naziv putanje ne daje administratorsku ovlast.

Ranije poddomene `portal`, `isvu`, `admin` i `webmail` na vlastitoj produkcijskoj domeni preusmjeravaju na odgovarajuće nove putanje. Za takve stare poveznice poddomene i dalje moraju biti spojene na Vercel. Lokalne i Vercel preview adrese zadržavaju postojeći `?module=` način rada; prihvaćaju i nove putanje. Webmail tipke koriste postojeću glavnu domenu, pa za njih nije potrebno stvarati `webmail.isvu.me`.

## Pošta i e-učenje

Merlin ima vlastite nastavne materijale, zadatke, predaje i povratne informacije povezane s ISVU kolegijima. Za uključivanje je potrebna migracija `202611090002_native_learning.sql`; vidi [MERLIN.md](MERLIN.md). Kvizovi i izravno učitavanje datoteka još nisu izvedeni. Ako postoji zaseban Moodle ili drugi LMS, opcionalna Vercel varijabla `MERLIN_LMS_URL` dodaje punu HTTPS adresu njegove prijave.

Webmail stranica na `/webmail` koristi opcionalnu varijablu `WEBMAIL_LOGIN_URL` za punu HTTPS adresu prijave pružatelja pošte. Bez nje prikazuje da servis nije povezan. Najprije treba aktivirati poštansku domenu i zasebne sandučiće kod odabranog pružatelja. ISVU adresa za prijavu sama ne stvara sandučić.

Obje su varijable obična konfiguracija, bez korisničkog imena ili lozinke u adresi. Nakon promjene potrebna je nova Vercel objava. Tipka otvara vanjsku prijavu u novoj kartici; ne uvodi jedinstvenu prijavu, prijenos ISVU lozinki, čitanje poruka ili sinkronizaciju kolegija. Te funkcije zahtijevaju zasebnu integraciju. Dodatna SQL migracija za ove pristupne stranice nije potrebna.

Vlastita domena ima prednost pred Vercelovim popisom adresa objave: čak i kada je `VERCEL_PROJECT_PRODUCTION_URL=isvu.me`, tipke koriste nove putanje i poddomene. U produkcijskom okruženju (`VERCEL_ENV=production`) dopuštene Vercel adrese preusmjeravaju na vlastitu domenu. Stare poveznice poput `https://isvu.me/?module=portal` također vode na novu adresu. Preview objave zadržavaju vlastite adrese i odvojene sesije. Ovaj ispravak poveznica ne zahtijeva dodatnu SQL migraciju.

## Prvo primijeniti migraciju

Na postojeći projekt nakon ranijih migracija primijeniti:

`supabase/migrations/202611090001_institution_routes.sql`

Kopija za SQL Editor može se izvršiti u transakciji `begin; … commit;`. Nova instalacija koristi ažurirani `supabase/setup.sql`; ne pokretati cijeli installer na postojećoj bazi.

Migracija dodaje jedinstvenu `institutions.url_slug`. Za postojeće ustanove početna je oznaka mala verzija važeće kratice ustanove, npr. `UFZG → ufzg`. Neprikladne stare kratice dobivaju jedinstvenu oznaku `vu-…`. Postojeći nazivi, računi i rasporedi ne mijenjaju se. Naknadna promjena naziva ili kratice ustanove ne mijenja već dodijeljenu oznaku.

U **Administracija sustava → Ustanove → Uredi ustanovu** (ili kroz postojeće dopušteno uređivanje ustanove) postaviti **Oznaka adrese rasporeda**:

- `ufzg` za odgovarajuće učilište
- `geofzg` za odgovarajuće učilište

Oznake su jedinstvene: 2–64 znaka, mala slova, brojevi i jednostruke crtice između dijelova. Ne koristiti punu URL adresu, razmake ili kose crte. Administratorska promjena oznake mijenja adresu rasporeda; postojeće podijeljene poveznice treba uskladiti.

## Prijava i odabir ustanove

Referada ustanovu određuje iz provjerenih korisničkih članstava i uloga, bez zaključivanja iz e-mail domene ili proizvoljnog URL parametra. Ako postoji jedna ustanova na kojoj korisnik ima ulogu referade/administratora, automatski se otvara ta ustanova. Ako ima više takvih ustanova, prikazuje se obvezan odabir. Ustanova na kojoj isti korisnik ima samo nastavničku ulogu ne nudi se kao referadska ustanova.

Raspored `/ufzg` učitava samo ustanovu s tom oznakom i podatke koje prijavljeni korisnik smije čitati. Promjena putanje ili `institution` parametra ne daje pristup drugoj ustanovi. Raspored ostaje za prijavljene korisnike; javna objava rasporeda nije uključena ovim zahtjevom. Kod otvaranja rasporeda prije prijave njegova se oznaka prenosi u prijavu i korisnik se vraća na isti raspored. Izmjene rasporeda i navigacija zadržavaju fakultetsku adresu.

## Vercel i DNS

Kod je pripremljen; ove se vanjske postavke ne stvaraju samim Git pushom.

1. U Vercel projektu dodati `isvu.me`, `studomat.isvu.me`, `referada.isvu.me`, `merlin.isvu.me`, `raspored.isvu.me` i `auth.isvu.me` u **Settings → Domains**, sve u isti projekt. Po potrebi dodati `www.isvu.me` i stare poddomene za preusmjeravanja.
2. U Vercel **Environment Variables** postaviti `BASE_DOMAIN=isvu.me` za okruženje objave. To je konfiguracija, bez protokola, putanje i porta. Ako već postoji druga vrijednost, zamijeniti je; zadana vrijednost u novom kodu ne nadjačava postojeću environment varijablu.
3. U Namecheapu ili kod stvarnog DNS pružatelja upisati **točne A/CNAME/TXT zapise koje Vercel prikaže za ovaj projekt**. Ne pretpostavljati univerzalnu IP adresu ili CNAME cilj. Za putanje `/admin`, `/ufzg` i `/geofzg` ne stvaraju se dodatni DNS zapisi.
4. Pričekati da Vercel potvrdi domene i HTTPS certifikate te objaviti pripremljenu verziju aplikacije.
5. U Supabase Auth postaviti Site URL `https://auth.isvu.me` i točnu callback adresu `https://auth.isvu.me/api/auth/callback`. Za postojeće adrese koje se još koriste u porukama zadržati njihove potrebne callbackove do usklađivanja predložaka; slijediti [FAZA-2.md](FAZA-2.md).
6. Provjeriti prijavu na `auth.isvu.me`, prelazak na Studomat i referadu, povratak na odabrani fakultetski raspored, odjavu te ograničenja studentskog/administratorskog pristupa.

Sesija koristi Secure/HttpOnly kolačić za `.isvu.me`, uz provjeru aktivne Auth sesije, uloga i RLS. Svaka mutacija i dalje provjerava vlastiti Origin. Vercel preview koristi svoj odvojeni host-only kolačić; proizvoljni `*.vercel.app` hostnameovi nisu dopušteni.

## Lokalna provjera

```sh
npm test
npm run db:test:migrate
npm run test:migrations
npm run build -- --webpack
npm run typecheck
npm run test:domain-routes
```

Opcionalni Chromium test koristi `WORKFLOW_PLAYWRIGHT_MODULE` kao putanju instaliranog playwright-core modula. Skripta pokreće vlastiti lokalni Next na portu 3011 i nakon testa vraća prethodne testne oznake i uloge.

Testovi pokrivaju kanonske produkcijske adrese kroz HTTP Host zaglavlja, sigurne dijeljene kolačiće, povratak s prijave, očuvanje oznake u navigaciji, izolaciju ustanove i jedno/više referadskih članstava. Chromium provjerava stvarni lokalni tok prijave i rasporeda. To nije potvrda javnog DNS-a, produkcijskih HTTPS certifikata ili dovršene Vercel objave.
