# Vlastito e-učenje u ISVU-u

Merlin na `https://merlin.isvu.me` koristi postojeću ISVU prijavu i evidenciju kolegija. Moodle instalacija i poštanski sandučić nisu potrebni. Ovo je vlastiti modul, odvojen od službenog Srce Merlina.

## Uključivanje postojeće instalacije

1. Na **ISVU Supabase projektu**, nakon ranijih migracija, u SQL Editoru izvršiti samo `supabase/migrations/202611090002_native_learning.sql`. Ne izvršavati `supabase/setup.sql` na postojećoj bazi.
   Za privatne privitke zatim izvršiti `supabase/migrations/202611090003_learning_files.sql`. Migracija sama stvara privatni Storage bucket `merlin-files`; ne uključivati javni pristup tom bucketu.
   Za granicu od 1 GB zatim izvršiti `supabase/migrations/202611090004_learning_files_1gb.sql`. Na Supabase **Storage → Settings → Global file size limit** postaviti najmanje 1 GiB (1024 MiB). Free paket dopušta najviše 50 MB po datoteci; za ovu granicu potreban je Pro ili viši paket. SQL i promjena aplikacije ne mijenjaju paket niti globalno ograničenje.
2. Objaviti novu verziju aplikacije kroz postojeću GitHub/Vercel integraciju. Nisu potrebni novi administratorski ključevi ili DNS zapisi ako `merlin.isvu.me` već radi.
3. U Administraciji studija odabrati ustanovu i kolegij. Nastavniku dodijeliti kolegij, a studentu evidentirati aktivni studij i upis kolegija. Samo članstvo u ustanovi ne otvara sve kolegije.
4. Na Merlinu otvoriti **Moji kolegiji**, odabrati kolegij i kliknuti **Otvori kolegij**. Naziv ustanove, akademska godina i semestar razlikuju ponavljanja istoga kolegija.

## Nastavnički postupak

- **Materijali → Dodaj materijal**: naslov te tekst, HTTPS poveznica ili datoteke. Odabir **Slike, videa i datoteke** nalazi se odmah u početnom obrascu. Klik na **Spremi materijal** sprema zapis i učitava odabrane datoteke. Ako materijal ima samo naslov i datoteke, kao tekst se sprema popis odabranih naziva datoteka. Označiti **Objavljeno studentima** kada je sadržaj spreman.
- **Zadaci → Dodaj zadatak**: upute, neobvezni rok u hrvatskom vremenu, maksimalni bodovi, pravilo zakašnjele predaje i odabir datoteka u istom obrascu. Klik na **Spremi zadatak** sprema zadatak i privitke.
- Kod stvaranja zapisa s privitcima objava studentima provodi se nakon potvrde svih prijenosa. Ako prijenos ne uspije, zapis ostaje nacrt, obrazac čuva vrijednosti, a ponovno spremanje nastavlja s preostalim odabranim datotekama bez ponovnog stvaranja zapisa. Nacrt se može pregledati i urediti; prije ponovnog odabira istih datoteka provjeriti već spremljene privitke.
- Ispod spremljenog materijala ili zadatka i dalje postoji **Dodaj slike, videa ili dokumente → Učitaj privitke** za naknadno dodavanje. Može se odabrati više datoteka. Prikazuju se napredak, rezultat prijenosa i mogućnost uklanjanja. Slike se prikazuju u stranici, video ima ugrađeni player, a dokumenti tipku za preuzimanje.
- **Predaje**: otvoriti studentov rad, upisati bodove i povratnu informaciju te spremiti. Bodovi moraju biti između nule i maksimuma zadatka. Nakon prve predaje maksimum se ne mijenja; rok i pravilo zakašnjenja mogu se promijeniti.

Administrator ustanove i referada mogu upravljati kolegijima svoje ustanove; glavni administrator svim ustanovama. Nastavnik radi na kolegijima na koje je izričito dodijeljen.

## Studentski postupak

Student otvara upisani kolegij i njegove objavljene materijale/zadatke. Na zadatku upisuje tekst ili HTTPS poveznicu na rad i klikne **Predaj rad**. Do roka i vrednovanja može zamijeniti svoju predaju. Ako nastavnik dopusti kašnjenje, predaje se primaju i poslije roka te je to vidljivo nastavniku. Vrednovana predaja je zaključana studentu; nastavnik može ispraviti bodove i povratnu informaciju.

Student vidi vlastite predaje i povratne informacije. Ostali studenti ih ne vide. Nastavnik vidi predaje samo svojih kolegija. Prestankom aktivnog upisa prestaje i pristup tom kolegiju.

## Granice ove verzije

Izvedeni su tekstualni materijali, poveznice, privatni privitci materijala/uputa zadataka, zadaci, studentske tekstualne predaje/poveznice, rokovi, bodovi i povratne informacije. Studentske predaje još nemaju izravno učitavanje datoteka. Kvizovi, forumi, rubrike, SCORM, prijenos Moodle arhiva i potpuna povijest sadržaja/predaja nisu izvedeni.

Podržani privitci: JPG/JPEG, PNG, GIF, WebP; MP4 i WebM; PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT i ZIP. Aplikacijska granica je 1 GiB (1.073.741.824 bajta, u sučelju 1 GB) po datoteci i 20 privitaka po materijalu ili zadatku. Vrijede i globalna ograničenja i ukupne kvote Supabase projekta. Veći prijenosi idu izravno u Storage. Prekinuti prijenos treba pokrenuti ponovno; nastavak od zadnjeg dijela još nije izveden.

Službena ograničenja: [Supabase Storage upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits). Standardni prijenos podržava datoteke do 5 GB, ali Supabase za velike datoteke preporučuje TUS prijenos s nastavkom; taj način ostaje zasebna nadogradnja.

Datoteka ide iz preglednika izravno u privatni Supabase Storage, pa video ne prolazi kroz ograničeni Vercel obrazac. Aplikacija odobrava putanju, provjerava završetak i povezuje privitak s postojećim materijalom ili zadatkom. Studentski pristup prati objavu i upis kolegija. Pristupne poveznice su kratkotrajne; dokumenti se preuzimaju, a samo podržane slike i video prikazuju unutar stranice. HTML i SVG nisu podržani privitci.

Ako se stranica zatvori prije završetka, nastavnik nakon ponovnog otvaranja vidi oznaku **Nedovršeno učitavanje** i može ukloniti taj privitak pa ga ponovno učitati. Student nedovršeni prijenos ne vidi. Kod redovnog prekida kroz sučelje uklanja se neuspjeli privitak. Bucket ostaje privatan; ne dijeliti Storage tokene kao trajne poveznice studentima.

Bodovi iz e-učenja **ne postaju automatski službene ocjene ispita ili ECTS bodovi**. Službena ispitna evidencija ostaje zasebna. Istodobno spremanje provjerava reviziju zapisa; zastarjeli obrazac zahtijeva osvježavanje.

## Kasnije povezivanje s Moodleom

Kolegiji e-učenja koriste postojeći stabilni ISVU `course_id`, ustanovu, godinu i semestar. Za budući adapter treba dodati mapiranje na Moodle identifikatore, ovlašten serverski pristup, pravila prijenosa upisa i sadržaja te evidenciju sinkronizacije. Takav adapter još nije izveden. Ne treba mijenjati lokalne identifikatore kolegija.

Korisnik je otvorio Moodle na Gnomiju: `https://merlinhr.gnomio.com/my/`. Merlin u ISVU-u na vrhu prikazuje **Otvori Moodle**; zadana adresa vrijedi i kada `MERLIN_LMS_URL` nije postavljen ili je prazan. Varijabla može postaviti drugu punu HTTPS adresu bez korisničkog imena/lozinke u URL-u. Pristupna tipka dostupna je i kada migracije vlastitog e-učenja još nisu primijenjene, nakon postojeće ISVU prijave i provjere ovlasti.

To je poveznica na zasebnu Moodle prijavu, bez prijenosa lozinki, jedinstvene prijave, automatskog stvaranja računa, uvoza postojećih materijala ili sinkronizacije kolegija. Vlastiti ISVU materijali i zadaci i dalje su dostupni ispod te poveznice. DNS za `merlin.isvu.me` nije promijenjen, a dostupnost Gnomio stranice i ovlasti na njoj provjeravaju se zasebno.

## Zoho i ISVU računi

Prema korisnikovu odabranom paketu Zoho je ograničen na pet poštanskih sandučića. To ne ograničava broj ISVU računa. Svaki sandučić ima vlastitu prijavu; ne treba dijeliti jedan sandučić među studentima ili ustanovama.

Webmail na `https://isvu.me/webmail` otvara vanjsku prijavu kada se u Vercelu postavi `WEBMAIL_LOGIN_URL` na stvarnu HTTPS adresu korištenog Zoho podatkovnog centra, primjerice `https://mail.zoho.eu` ili `https://mail.zoho.com`, i pokrene nova objava. Varijabla je konfiguracija; ne unositi Zoho lozinku. Tipka ne stvara dodatne račune ili poruke i ne zaobilazi ograničenje paketa.

Koraci za Namecheap, MX, SPF, DKIM, otvaranje računa i provjeru poruka: [ZOHO-POSTAVLJANJE.md](ZOHO-POSTAVLJANJE.md).

ISVU korisničko ime koje izgleda kao adresa nije samo po sebi sandučić. Za račune bez stvarne pošte koristiti postojeći administratorski postupak ispisa početnih pristupnih podataka i obveznu promjenu početne lozinke. Oporavak e-poštom moguć je samo za stvarno dostupan sandučić.

## Provjera

`npm test`, `npm run typecheck`, `npm run build -- --webpack`, `npm run db:test:migrate`, `npm run test:migrations`, `npm run test:learning` i `npm run test:learning-files`. Lightweight testni profil sada uključuje službeni Supabase Storage servis (`node scripts/local-storage.mjs`); pristupnik treba uključivati `/storage/v1` rutu. Nova puna lokalna instalacija pokreće Storage prije aplikacijskih migracija.

Integracijska skripta koristi samo lokalni Supabase i testne račune te uklanja svoje privremene zapise. Opcionalni `WORKFLOW_PLAYWRIGHT_MODULE` uključuje stvarni Chromium postupak objave, predaje i povratne informacije. Produkcijski računi, pošta i Moodle ne mijenjaju se ovim testovima.
