# Vlastito e-učenje u ISVU-u

Merlin na `https://merlin.isvu.me` koristi postojeću ISVU prijavu i evidenciju kolegija. Moodle instalacija i poštanski sandučić nisu potrebni. Ovo je vlastiti modul, odvojen od službenog Srce Merlina.

## Uključivanje postojeće instalacije

1. Na **ISVU Supabase projektu**, nakon ranijih migracija, u SQL Editoru izvršiti samo `supabase/migrations/202611090002_native_learning.sql`. Ne izvršavati `supabase/setup.sql` na postojećoj bazi.
2. Objaviti novu verziju aplikacije kroz postojeću GitHub/Vercel integraciju. Nisu potrebni novi administratorski ključevi ili DNS zapisi ako `merlin.isvu.me` već radi.
3. U Administraciji studija odabrati ustanovu i kolegij. Nastavniku dodijeliti kolegij, a studentu evidentirati aktivni studij i upis kolegija. Samo članstvo u ustanovi ne otvara sve kolegije.
4. Na Merlinu otvoriti **Moji kolegiji**, odabrati kolegij i kliknuti **Otvori kolegij**. Naziv ustanove, akademska godina i semestar razlikuju ponavljanja istoga kolegija.

## Nastavnički postupak

- **Materijali → Dodaj materijal**: naslov te tekst ili HTTPS poveznica na dokument/video. Označiti **Objavljeno studentima** kada je sadržaj spreman. Nacrt je vidljiv samo ovlaštenom osoblju kolegija. Uređivanjem se sadržaj može ponovno sakriti.
- **Zadaci → Dodaj zadatak**: upute, neobvezni rok u hrvatskom vremenu, maksimalni bodovi i pravilo zakašnjele predaje. Zadatak postaje dostupan studentima tek objavom.
- **Predaje**: otvoriti studentov rad, upisati bodove i povratnu informaciju te spremiti. Bodovi moraju biti između nule i maksimuma zadatka. Nakon prve predaje maksimum se ne mijenja; rok i pravilo zakašnjenja mogu se promijeniti.

Administrator ustanove i referada mogu upravljati kolegijima svoje ustanove; glavni administrator svim ustanovama. Nastavnik radi na kolegijima na koje je izričito dodijeljen.

## Studentski postupak

Student otvara upisani kolegij i njegove objavljene materijale/zadatke. Na zadatku upisuje tekst ili HTTPS poveznicu na rad i klikne **Predaj rad**. Do roka i vrednovanja može zamijeniti svoju predaju. Ako nastavnik dopusti kašnjenje, predaje se primaju i poslije roka te je to vidljivo nastavniku. Vrednovana predaja je zaključana studentu; nastavnik može ispraviti bodove i povratnu informaciju.

Student vidi vlastite predaje i povratne informacije. Ostali studenti ih ne vide. Nastavnik vidi predaje samo svojih kolegija. Prestankom aktivnog upisa prestaje i pristup tom kolegiju.

## Granice ove verzije

Izvedeni su tekstualni materijali, poveznice na dokumente, zadaci, predaje, rokovi, bodovi i povratne informacije. Datoteke se još ne učitavaju izravno u ISVU; poveznica mora omogućiti pristup potrebnim osobama na odabranom servisu. Kvizovi, forumi, rubrike, SCORM, prijenos arhiva i potpuna povijest sadržaja/predaja nisu izvedeni.

Bodovi iz e-učenja **ne postaju automatski službene ocjene ispita ili ECTS bodovi**. Službena ispitna evidencija ostaje zasebna. Istodobno spremanje provjerava reviziju zapisa; zastarjeli obrazac zahtijeva osvježavanje.

## Kasnije povezivanje s Moodleom

Kolegiji e-učenja koriste postojeći stabilni ISVU `course_id`, ustanovu, godinu i semestar. Za budući adapter treba dodati mapiranje na Moodle identifikatore, ovlašten serverski pristup, pravila prijenosa upisa i sadržaja te evidenciju sinkronizacije. Takav adapter još nije izveden. Ne treba mijenjati lokalne identifikatore kolegija.

Opcionalni `MERLIN_LMS_URL` može već sada prikazati poveznicu na zasebni Moodle. To je samo vanjska prijava, bez prijenosa lozinki, jedinstvene prijave ili sinkronizacije. Vlastiti Merlin nastavlja raditi i bez te varijable.

## Zoho i ISVU računi

Prema korisnikovu odabranom paketu Zoho je ograničen na pet poštanskih sandučića. To ne ograničava broj ISVU računa. Svaki sandučić ima vlastitu prijavu; ne treba dijeliti jedan sandučić među studentima ili ustanovama.

Webmail na `https://isvu.me/webmail` otvara vanjsku prijavu kada se u Vercelu postavi `WEBMAIL_LOGIN_URL` na stvarnu HTTPS adresu korištenog Zoho podatkovnog centra, primjerice `https://mail.zoho.eu` ili `https://mail.zoho.com`, i pokrene nova objava. Varijabla je konfiguracija; ne unositi Zoho lozinku. Tipka ne stvara dodatne račune ili poruke i ne zaobilazi ograničenje paketa.

ISVU korisničko ime koje izgleda kao adresa nije samo po sebi sandučić. Za račune bez stvarne pošte koristiti postojeći administratorski postupak ispisa početnih pristupnih podataka i obveznu promjenu početne lozinke. Oporavak e-poštom moguć je samo za stvarno dostupan sandučić.

## Provjera

`npm test`, `npm run typecheck`, `npm run build -- --webpack`, `npm run db:test:migrate`, `npm run test:migrations` i `npm run test:learning`.

Integracijska skripta koristi samo lokalni Supabase i testne račune te uklanja svoje privremene zapise. Opcionalni `WORKFLOW_PLAYWRIGHT_MODULE` uključuje stvarni Chromium postupak objave, predaje i povratne informacije. Produkcijski računi, pošta i Moodle ne mijenjaju se ovim testovima.
