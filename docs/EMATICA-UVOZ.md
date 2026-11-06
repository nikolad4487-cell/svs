# Prvi upis učenika i preuzimanje postojećih upisa u ISVU

## Prvi upis na fakultet — glavni postupak

U **Administracija sustava → Uvoz upisa** zadano se otvara **Prvi upis na fakultet**. Ovdje administrator provodi prvi upis učenika u ISVU. To nije prijelaz između fakulteta i ne traži prethodni fakultetski upis u e-Matici.

1. Kliknite **Učitaj učilišta i studije iz ISVU-a**. Ovaj korak čita samo ISVU; radi i bez ponude fakulteta, programa ili godina u e-Matici te bez dostupnog izvornog ključa.
2. Odaberite ISVU učilište, njegov studijski program, akademsku godinu i dopuštenu domenu novih korisničkih imena. Unesite naziv postupka / pravilo upisa i spremite postupak. Možete ga pripremiti prije početka mature i upisnih rokova.
3. Odaberite spremljeni postupak i kliknite **Dohvati završene učenike iz e-Matice**. Tek ovaj korak zahtijeva izvorni Supabase URL i serverski ključ.
4. Prikazuju se učenici sa završenom srednjom školom: zapis `GRADUATED` u godišnjem izvještaju ili upisu srednje škole. Osnovne škole i sama prijava mature ne zadovoljavaju taj uvjet. Ako završetak škole još nije evidentiran, popis je prazan uz objašnjenje; konfiguracija ISVU postupka ostaje dostupna.
5. Administrator provjerava potrebnu maturu i uvjete ciljnog programa, navodi dokaz/odluku te izričito odobrava prvi upis. Podatak o položenoj maturi ne izmišlja se iz prijave ispita. Eventualno izuzeće od mature mora biti utemeljeno u pravilima programa.
6. Odabere spremne učenike i klikne **Upiši odabrane učenike u ISVU**. Ovdje nastaju ISVU račun, studentsko članstvo i upis studija; nije potreban izvorni fakultet, izvorni fakultetski program ili prethodno provedeni fakultetski upis.
7. Ispiše ili preuzme početne pristupne podatke. Ponovljeni zahtjev ne stvara novi upis i ne mijenja postojeću lozinku. Kolegiji se zatim dodjeljuju u Administracija studija → Studenti i upisi.

Potrebna je dodatna migracija **`202611060001_first_enrollment.sql`**, nakon prethodnih migracija. Ona čuva postojeća povezivanja kao postupak `recorded` i dodaje način `first`, s odlukom prvog upisa. Ne mijenja postojeće studente, lozinke ili izvorne podatke. Učitavanje početnih ISVU podataka ne ovisi o vanjskim fakultetskim podacima.

## Odvojeno preuzimanje već provedenih upisa

Druga kartica **Preuzimanje već provedenih upisa** namijenjena je samo slučajevima u kojima fakultetski upis već postoji u e-Matici. Nije preduvjet prvog upisa i njezini prazni izvorni izbornici ne blokiraju prvi postupak. Sljedeći odjeljci opisuju taj odvojeni način.

## Što je izvor

Izvor je zajednički Supabase projekt e-Matice/e-Dnevnika. Modul `fakulteti.skolehr.xyz` sprema kandidaturu i prihvaćen izbor; postupak **Provedi upis prihvaćenih** kreira aktivni `student_school_enrollments` u odabranom učilištu/programu. Prijenos u ISVU provjerava oba zapisa. Sama lista prioriteta, status ACCEPTED bez provedenog upisa ili ručni ACTIVE zapis bez odgovarajuće kandidature nisu dovoljni.

U pregledanoj shemi mature postoje `matura_registrations`, `matura_study_applications` i uvjeti programa, ali nema strukturiranog konačnog rezultata iz kojeg bi se pouzdano zaključio prolaz svih potrebnih ispita. Stranica za nastavnike je `https://ednevnik.skolehr.xyz/teacher/matura`. Prijava mature se nikad ne računa kao položena matura: dok izvor ne dobije jednoznačne potvrđene rezultate, glavni administrator provjerava dokument i evidentira oznaku dokaza. Završetak srednje škole može se potvrditi izvornim `student_year_end_summaries.status=GRADUATED` za istog učenika i izvornu školu ili dokumentiranom administratorskom provjerom.

Izvor se samo čita. Ne kopiraju se prethodne lozinke, PIN-ovi, OIB, datum rođenja ili adrese.

## Aktivacija

1. Na SVS projektu primijenite nedostajuće migracije redom, uključujući `202611020002_import_passwords.sql` i `202611030001_verified_admissions.sql`. Za novi projekt `supabase/setup.sql` sadrži puni installer; ne pokrećite ga na već instaliranoj bazi.
2. Postavite ustanove, dopuštene domene, studijske programe i akademske godine u ISVU-u.
3. U serverskim postavkama aplikacije (Vercel, ako je tamo objavljena) postavite `EMATICA_SUPABASE_URL`, `EMATICA_SUPABASE_SECRET_KEY`, `SVS_SUPABASE_URL` i `SVS_SUPABASE_SECRET_KEY`. Ključevi su serverski secret/service-role ključevi odgovarajućih zasebnih projekata, nikad `NEXT_PUBLIC_*` ili `VITE_*`. Postavke u cloud razvojnom okruženju ne prenose se automatski u Vercel. Za proxy pohranu tajni svaki ključ smije se slati samo na točan hostname njegova projekta.
4. Ponovno objavite aplikaciju nakon dodavanja serverskih varijabli. Objavljivanje aplikacije ne provodi SQL migracije i ne prenosi učenike.

## Administratorski postupak bez JSON mapiranja

U **Administracija sustava → Uvoz upisa → Preuzimanje već provedenih upisa** glavni administrator:

1. Klikne **Dohvati ponudu i mapiranja**. To čita nazive/identifikatore izvornih programa i godina te postojeća ISVU mapiranja; ne stvara korisnike.
2. Poveže izvorni fakultet/program, godinu kandidature i godinu provedenog upisa s točnom ISVU ustanovom/programom/godinom. Odabire dopuštenu domenu korisničkih imena. Godina kandidature i upisa mogu biti različite ako je izvorna Provedba upisa koristila drugu godinu.
3. Navede odluku/pravilo upisa. Matura je po zadanim postavkama obvezna; može se izuzeti samo uz stvarnu dokumentiranu osnovu programa.
4. Klikne **Provjeri upise bez spremanja**. Svaki kandidat ima popis razloga koji blokiraju prijenos. Pregled ne stvara Auth račune, pozive ni upise.
5. Uz kandidata evidentira provjeru mature i uvjeta programa, uz oznaku vjerodostojnog dokumenta. Ako izvor nema dokaz završetka škole, mora provjeriti i njega. Osoba i vrijeme provjere bilježe se automatski; student ili administrator pojedine ustanove ne mogu odobriti ovaj globalni prijenos.
6. Odabere spremne kandidate i klikne **Preuzmi odabrane potvrđene upise** (najviše pet po zahtjevu). Poslužitelj ponovno čita izvor i provjere prije prijenosa, bez povjerenja u prethodni pregled ili podatke iz preglednika.
7. Odmah ispiše ili preuzme nove pristupne podatke. Svaki novi student dobiva zaseban A4 list. U slučaju djelomičnog neuspjeha sačuvajte i već izdane pristupne podatke pa provjerite status.

Mapiranja se mogu urediti ili isključiti. Promjena pravila poništava primjenjivost starih provjera: administrator mora ponovno potvrditi dokumente uz novu reviziju. Promjena izvornog učenika ili prihvaćenog izbora također onemogućuje uporabu stare provjere. Identitet mapiranja (izvorni/odredišni program i godine) ne može se mijenjati nakon što postoje pokušaji prijenosa; napravite novo mapiranje za novu kombinaciju. Već preneseni računi ne opozivaju se automatski nakon promjene izvora ili pravila.

## Računi, lozinke i ponavljanje

Korisničko ime je `ime.prezime.<stabilni-sufiks>@domena`. Izvorni identitet i odredišna ustanova služe za povezivanje postojećeg računa. Ne preuzima se nepovezan račun istog korisničkog imena, ne duplicira se postojeći upis i ne mijenja se postojeća lozinka. Različite ustanove dobivaju odvojene račune. Ovo ne stvara e-mail sandučiće i ne šalje e-poštu.

Za novi račun generira se zasebna nasumična inicijalna lozinka; aplikacija i RLS blokiraju studijske podatke do njezine promjene. Početni podaci iz administratorskog pregleda ostaju samo u pregledniku i u datoteci koju preuzme administrator, ne u bazi aplikacije ili konzoli. Pristupne podatke uručite samo odgovarajućem studentu, nakon provjere identiteta.

Prijenos dobiva rezervaciju u `admission_import_jobs`: paralelni zahtjev za isti upis ne može izdati novu lozinku. Dovršen zahtjev se preskače; neuspjeli se može nastaviti nakon pregleda. Rezervacija `running` ne poništava se automatski nakon prekida procesa; prvo treba administratorski provjeriti Auth račun i status posla. Ne brišite naslijepo postojeće račune niti pokrećite paralelne prijenose.

Nije moguće transakcijski obuhvatiti dva Supabase projekta i odgovor pregledniku. Ako se veza prekine nakon stvaranja računa, nova lozinka možda nije stigla do administratora. Ponovljeni postupak ne mijenja tu lozinku: najprije treba provjeriti postojeći račun i organizirati kontrolirani oporavak pristupa. Ako račun već postoji, rezultat neće izmišljati niti ponovno prikazivati njegovu staru lozinku.

## CLI za isti provjereni postupak

Stari `--config` uvoz samo na temelju ACTIVE zapisa je uklonjen. Koristi se spremljeno mapiranje i iste provjere kao u aplikaciji:

```sh
# Pregled bez spremanja, iz /workspace/svs:
npm run import:ematica -- --mapping UUID-MAPIRANJA
# Administratorski prijenos spremnih kandidata:
npm run import:ematica -- --mapping UUID-MAPIRANJA --apply --credentials /workspace/novi-racuni.jsonl
```

Potrebne su iste četiri serverske varijable. Datoteka mora biti nova i izvan repozitorija; izrađuje se s dozvolama 0600. CLI zapisuje `candidate` prije stvaranja računa i `created` nakon potvrde Auth API-ja. Sam `candidate` ne dokazuje uspjeh. Zadržite izlaznu datoteku i kod djelomičnog neuspjeha; ponavljanje stvara novi izlazni dokument, bez mijenjanja postojećih lozinki.

## Ispis i pozivi na čekanju

Izvoz `.jsonl` može se ponovno učitati u **Administracija sustava → Ispis podataka za prvu prijavu** i ispisati u zasebnim listovima. Nepotvrđeni pokušaji se ne ispisuju. Ispis stare inicijalne lozinke ne vraća lozinku koju je korisnik već promijenio.

Uz neprihvaćen važeći registracijski poziv postoji i odvojeni postupak **Izradi početne podatke i ispiši**, uz izričitu administratorsku potvrdu identiteta. Njega omogućuje migracija `202611020003_pending_credentials.sql`; on ne zamjenjuje provjere za uvoz studenata iz drugog sustava i ne resetira već potvrđene račune.

## Provjere

`npm test` provjerava prihvaćeni izbor, stvarni upis, završetak škole, obveznu maturu ili dokumentirano izuzeće te vezu provjere s učenikom, izborom i revizijom mapiranja.

`npm run test:migrations` provjerava čistu instalaciju i RLS svih 26 aplikacijskih tablica.

`npm run test:ematica` također provjerava prvi upis: pripremu ISVU postupka bez izvornog kataloga, prazan popis prije evidentiranja završetka škole, odobrenje administratora, izradu prvog upisa i ponavljanje bez dupliciranja. Preglednički se provjerava da zadani obrazac nema izvorni fakultet/program i da se može popuniti i kada izvorni katalog nije dostupan.

`npm run test:ematica`, uz pripremljen lokalni profil i izgrađenu aplikaciju, pokreće vlastiti lokalni Next server na portu 3007 (ili `ADMISSION_TEST_PORT`). Simulira izvornu shemu e-Matice i koristi stvarni lokalni Supabase Auth/PostgreSQL. Provjerava pregled bez upisa, dokumentirane provjere, promjenu izvora nakon pregleda, paralelne zahtjeve, početne lozinke, ponavljanje bez promjene lozinke, CLI zaštitu i ovlasti. Ne prenosi produkcijske učenike niti mijenja izvor.


## Ako dohvat ponude ne radi na Vercelu

Razvojno cloud okruženje i Vercel imaju odvojene serverske varijable. U **Vercel → Settings → Environment Variables → Production** provjerite:

- `EMATICA_SUPABASE_URL`: `https://hkqlbeetlvrplaeubncc.supabase.co`.
- `EMATICA_SUPABASE_SECRET_KEY`: serverski ključ izvornog e-Matica/e-Dnevnik projekta, spremljen kao Sensitive.
- `SVS_SUPABASE_URL`: `https://wjxmyxxwqspwswfwjpdn.supabase.co`.
- `SVS_SUPABASE_SECRET_KEY`: serverski ključ odredišnog SVS projekta, spremljen kao Sensitive.

Nakon dodavanja ili izmjene varijabli napravite **Redeploy**. Ključeve nemojte slati u chat. Za sam katalog potreban je izvorni ključ; odredišni serverski ključ potreban je za stvaranje računa pri prijenosu. Aplikacijska prijava i čitanje odredišnih mapiranja koriste postojeću sesiju glavnog administratora.

Nedostajuće varijable sada se navode imenom. Greška pojedinog dohvata prikazuje naziv izvora/tablice i siguran kod baze; sirovi odgovori, ključevi i učenički podaci ne prenose se u poruku greške. Nedostatak SVS sheme razlikuje se od nedostatka ovlasti u izvornom projektu.
