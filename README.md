# SVS · Sustav visokog obrazovanja

Next.js 16 App Router, TypeScript, Tailwind CSS 4, shadcn/ui Button (Radix Slot + CVA) i Lucide. Projekt za Vercel s modularnim usmjeravanjem po Host zaglavlju.

## Stanje: faza 1

Implementirani su glavna stranica, devet zasebno imenovanih modula, navigacija unutar i između modula, responzivno sučelje, tamni način, loading/error/404 prikazi i sigurno mapiranje hostnamea. Podstranice koriste `view` parametar za izbor odjeljka. Kartice iskreno prikazuju razvojni status, a ne zdravlje nepovezanih usluga.

**Nisu još implementirani** Supabase, prijava/odjava, SSO, autorizacija, poslovni CRUD, baze, RLS, testni korisnici, stvarni LMS ni integracija pošte. Modul admin je samo javna informativna ljuska bez privilegiranih podataka ili radnji. To nije zaštita budućih administrativnih API-ja: njih u fazi 2 treba zaštititi serverskom autorizacijom i RLS-om. Nema lažnih podataka, aktivnih obrazaca prijave ni službene integracije ISVU/Merlin.

## Lokalni rad

Preduvjet: Node.js 22.13+ (provjereno s 24), npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Glavna stranica: `localhost:3000`. Moduli: `portal`, `studomat`, `merlin`, `webmail`, `isvu`, `referada`, `raspored`, `auth`, `admin`, svaki kao `<modul>.localhost:3000`. `www.localhost:3000` također prikazuje početnu.

Ako preglednik ne razrješava poddomene, otvorite `localhost:3000/?module=studomat`. Poveznice tada zadržavaju ovaj način pristupa. Za alternativni hostname postavite `LOCAL_BASE_DOMAIN=svs.test` i dodajte `127.0.0.1 svs.test studomat.svs.test ...` u lokalni hosts za svaku potrebnu poddomenu. Hosts datoteka ne podržava wildcard. Može se koristiti i `127.0.0.1:3000/?module=studomat`.

`BASE_DOMAIN` je samo hostname bez protokola, porta ili putanje. Zadana vrijednost je `domena.hr`. Nepoznate domene i poddomene daju 404. Proxy ignorira proslijeđene hostove i prepisuje interne kontekstne headere. Izravan pristup `/sites/*` je blokiran. `?module=` radi samo na lokalnim hostnameovima. Vercelove adrese automatski se dopuštaju samo ako ih platforma postavi u `VERCEL_URL` ili `VERCEL_PROJECT_PRODUCTION_URL` uz `VERCEL=1`. Na tim adresama svi moduli koriste `?module=` i HTTPS, jer Vercelova besplatna domena ne omogućuje vlastite wildcard poddomene. Proizvoljne `*.vercel.app` adrese nisu dopuštene.

## Provjere

```sh
npm test
npm run build
npm run typecheck
npm start
# u drugom terminalu, dok server radi na portu 3000:
npm run test:smoke
```

Unit testovi pokrivaju sve poddomene, promjenu domene, odbijanje lažnih hostova i lokalne poveznice. HTTP testovi provjeravaju stvarne odgovore servera, zasebne module, lokalne i produkcijske hostnameove, fallback i 404. Autentifikacija i izolacija ustanova moraju dobiti testove zajedno s implementacijom u fazi 2; trenutačno se ne tvrdi da su provjerene.

## Organizacija

- `src/proxy.ts`: sigurno mapiranje Host → interna ruta.
- `src/lib/hosts.ts`: čiste funkcije hostnamea i URL-ova.
- `src/lib/modules.ts`: dopušteni moduli i odjeljci.
- `src/app/sites/[module]`: serverski prikaz pojedinog modula.
- `src/components/ui`: temeljne shadcn/ui komponente.

Novi modul zahtijeva izmjenu odobrenog registra u kodu; nije moguće proizvoljno izvršavanje ruta ili koda iz korisničkog unosa.

## Vercel i domene

1. Pohranite projekt u GitHub i u Vercelu odaberite Import Project → repozitorij → framework Next.js. Korijen projekta je korijen repozitorija; build `npm run build`.
2. U Project Settings → Environment Variables postavite `BASE_DOMAIN` na odabranu glavnu domenu. Nemojte postavljati `LOCAL_BASE_DOMAIN` u produkciji. Nakon promjene varijabli ponovno objavite projekt.
3. U Domains dodajte glavnu domenu, `www` i svaku navedenu poddomenu, ili glavnu domenu i wildcard `*.domena.hr`. Slijedite konkretne DNS zapise koje Vercel prikaže; aplikacija ne registrira niti mijenja domenu.
4. Za wildcard TLS slijedite aktualne Vercel zahtjeve (u pravilu delegacija na Vercel nameservere). Ako delegacija nije moguća, dodajte pojedinačne poddomene i njihove DNS zapise. Vercel izdaje HTTPS certifikate nakon potvrde DNS-a.
5. Sve domene moraju pripadati istom Vercel projektu. Provjerite HTTPS svake domene i nepoznatu poddomenu ako koristite wildcard.

## Sljedeća faza: Supabase i SSO

Kreirati zaseban Supabase projekt, migracije, višestruka članstva i RLS prije izlaganja korisničkih podataka. Tada dodati `NEXT_PUBLIC_SUPABASE_URL` i publishable ključ (javni), a serverske tajne držati isključivo u Vercel/Supabase postavkama, nikad u kodu. U Auth konfigurirati dopuštene callback/reset URL-ove i pravila registracije ustanove.

Plan SSO-a je serversko upravljanje sesijama i HttpOnly kolačić za zajedničku roditeljsku domenu, sa Secure u produkciji, SameSite i CSRF provjerama za promjene podataka. Dijeljenje kolačića zahtijeva da sve poddomene budu pouzdane; localhost treba zasebno provjeriti i po potrebi koristiti lokalnu testnu domenu. Redirect odredišta moraju biti ograničena na poznate module. Ove sigurnosne značajke još nisu implementirane.

Promjena domene zahtijevat će novi DNS/TLS, `BASE_DOMAIN`, nove Supabase callback URL-ove i domenu kolačića te ponovnu prijavu. Pošta zahtijeva stvarni Microsoft 365/Zoho račun i odgovarajuće API ovlasti; Moodle integracija zahtijeva ovlaštenu instalaciju i podržani API/SSO. Bez tih usluga ne prikazivati poruke ili službene integracije kao aktivne.

## Brza objava bez vlastite domene

Na Vercelu uvezite GitHub repozitorij `nikolad4487-cell/svs` (grana `main`) ili koristite gumb za objavu ispod. Framework, instalacija i build zadani su u `vercel.json`. Za fazu 1 ne trebate tajne ni dodatne environment variables. Vercel automatski daje HTTPS adresu; moduli rade na toj istoj adresi preko `?module=studomat` i drugih slugova. Kada kupite domenu, dodajte DNS i postavite `BASE_DOMAIN` prema gornjim uputama.

[Objavi na Vercelu](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnikolad4487-cell%2Fsvs&project-name=svs&repository-name=svs)

Objava zahtijeva vaš prijavljen Vercel račun i dopušten pristup repozitoriju. Ovaj gumb ne znači da je aplikacija već objavljena.
