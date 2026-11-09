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

Portal na `/admin` dostupan je prijavljenom korisniku prema njegovim ovlastima. Administracija sustava i dalje je samo za glavnoga administratora, a administracija studija za odgovarajuće osoblje. Sam naziv putanje ne daje administratorsku ovlast.

Ranije poddomene `portal`, `isvu` i `admin` na vlastitoj produkcijskoj domeni preusmjeravaju na odgovarajuće nove putanje. Za takve stare poveznice poddomene i dalje moraju biti spojene na Vercel. Lokalne i Vercel preview adrese zadržavaju postojeći `?module=` način rada; prihvaćaju i nove `/admin` putanje. Webmail ostaje postojeći zasebni modul ako se koristi; ova promjena ne konfigurira pružatelja pošte ili stvarni LMS.

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
