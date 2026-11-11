# ISSP u vlastitoj ISVU aplikaciji

Adresa: **https://issp.isvu.me**. Modul koristi postojeću ISVU prijavu i istu bazu. To je vlastita evidencija studentskog standarda prema korisnikovim primjerima, bez povezivanja s državnim ISSP-om, HZMO-om, stvarnim blagajnama, izdavateljem iskaznica ili sustavom stipendija.

## Uključivanje

1. U ISVU Supabase projektu `wjxmyxxwqspwswfwjpdn` primijeniti `supabase/migrations/202611110001_issp.sql`, nakon postojećih akademskih migracija i referade `202611060005_registrar_workbench.sql`. Ne treba novi Supabase projekt. Ova migracija ne zahtijeva migracije kvizova ili cjelina Merlina.
2. Postojeći ISVU projekt treba imati `courses`, `student_studies` i `student_records`. Ako nedostaju, najprije provjeriti projekt/granu i redoslijed osnovnih migracija. Ne stvarati zamjenske prazne tablice i ne pokretati cijeli `supabase/setup.sql` na postojećoj bazi.
3. Nova migracija dodaje pet tablica s RLS-om i privatni Storage bucket `issp-photos` za fotografije do 2 MiB. Postojeći podaci ostaju sačuvani. Izmjene se evidentiraju postojećim dnevnikom administrativnih radnji, bez kopiranja osobnih sadržaja u dnevnik.
4. U istom Vercel projektu dodati `issp.isvu.me` u **Settings → Domains**. Ako postojeća wildcard domena već obuhvaća taj naziv, ne treba dodavati suprotan DNS zapis.
5. U Namecheap **Advanced DNS** dodati CNAME s hostom `issp` i **točnim ciljem koji Vercel prikaže za ovaj projekt**. Ukloniti samo proturječni zapis za isti host, ako postoji. Ne mijenjati postojeće MX/SPF/DKIM zapise.
6. Pričekati potvrdu domene i HTTPS-a u Vercelu te novu objavu aplikacije. `BASE_DOMAIN=isvu.me`, Supabase varijable i centralna prijava ostaju postojeći. Nove lozinke/ključevi nisu potrebni. Prijava se i dalje odvija preko `auth.isvu.me` s postojećom dijeljenom sesijom.

GitHub prijenos ne postavlja DNS, domenu u Vercelu niti izvršava produkcijsku SQL migraciju. Vanjske postavke i dovršena objava provjeravaju se odvojeno.

## Referada i administrator ustanove

1. Otvoriti ISSP iz popisa modula ili poveznice u referadi/Studomatu. Odabrati ustanovu, studenta i akademsku godinu. Student mora prethodno imati stvarni upis u referadi; sam ISSP ne stvara studente ni upise.
2. U **Upravljanje evidencijom** spremiti razinu i razdoblje prava, izričitu odluku **Pravo na prehranu odobreno**, neobvezan dnevni iznos potpore i oznaku odluke. Prazan dnevni iznos znači da nije evidentiran. Novi račun počinje sa saldom nula, bez automatski dodijeljenog novca.
3. **Dodjela potpore ili osobni račun** prima pozitivne iznose u EUR s najviše dvije decimale i hrvatskim datumom/vremenom. Dodjela povećava saldo. Kod računa ukupna cijena i iznos korištene potpore vode se zasebno; saldo se umanjuje samo za potporu.
4. Dodjela potpore ne provodi se automatski po danima ili polovinama mjeseca. Osoblje unosi stvarne dodjele prema svojim pravilima. Dnevni iznos je evidentirani podatak, a ne automatski limit potrošnje.
5. Potrošnja je dopuštena samo uz odobreno pravo, unutar njegova razdoblja i bez evidentiranog prestanka. Saldo ne smije biti negativan. Budući datumi i isti broj/oznaka s drukčijim sadržajem odbijaju se. Istovjetno ponovno slanje iste transakcije ne udvostručuje saldo.
6. Pogrešan financijski zapis **stornira se** s novom jedinstvenom oznakom i razlogom. Izvornik ostaje vidljiv. Dodjela se ne može stornirati ako bi saldo postao negativan; potrošnja ili dodjela mogu se stornirati samo jednom.
7. Unijeti potrebne kriterije studentskog rada/prehrane, zaposlenje, prestanak, posebno pravo, invaliditet i evidentiranu suglasnost, dom, mirovanje, iskaznice, privremene iskaznice, mobilnost, vlasništvo u ustanovi ili stvarno dodijeljeni ESI. Svaki zapis ima izvor/oznaku odluke. Neprovjeren kriterij ne smatra se zadovoljenim.
8. Pogrešna nefinancijska evidencija povlači se isključivanjem **Zapis vrijedi**. Izmjene provjeravaju reviziju; zastarjeli obrazac treba osvježiti. Prestanak prava prestaje blokirati potrošnju tek nakon povlačenja pogrešnog zapisa ili ispravka datuma.
9. Telefon i fotografija unose se odvojeno. Fotografije JPG, PNG i WebP do 2 MiB i 20 megapiksela provjeravaju se stvarnim dekodiranjem te pohranjuju privatno kao JPEG do 1000 × 1000 piksela, bez EXIF metapodataka. Nova fotografija zamjenjuje prethodnu nakon provjere revizije. Službeno ime, OIB, JMBAG, datum rođenja, državljanstvo, godišnja adresa i upisi uređuju se u postojećoj referadi.

Nazivi i brojevi iskaznica jesu lokalna evidencija. Njihovo spremanje ne naručuje, ne tiska i ne aktivira državnu fizičku iskaznicu. ESI se unosi samo ako je stvarno dodijeljen, bez automatskog stvaranja iz JMBAG-a.

## Student

Student automatski vidi svoje podatke i samo ustanove u kojima ima odgovarajuću studentsku ulogu. Ustanova i godina mogu se promijeniti ako postoji više upisa. Nema administratorskih obrazaca ni pristupa drugim studentima.

- Pregled sadrži privatnu fotografiju, matične/godišnje podatke, odluku o pravima, saldo i današnju potrošnju prema hrvatskom datumu. Prazne evidencije prikazuju se kao neevidentirane, bez kopiranja vrijednosti s referentnih slika.
- Kriteriji i ostale evidencije prikazuju stvarne unose referade. Ne dohvaćaju se podaci iz HZMO-a.
- Godišnji upisi i poslijediplomski postupci čitaju se iz referade. ECTS i težinski prosjek računaju se iz evidentiranih položenih ispita, bez izmišljanja rezultata ili potvrde za stipendiju. Dodatni priznati ECTS ostaju zasebno u Studomatu.
- **Osobni računi** prikazuju posljednjih 30 dana odabrane godine. **Preuzmi sve osobne račune (.pdf)** izrađuje stvarni PDF s hrvatskim znakovima i svim lokalnim transakcijama tog studenta u odabranoj ustanovi, uključujući dodjele i storna kroz godine.
- Student sam sprema e-adresu i odabir primanja obavijesti. Slanje e-pošte još nije aktivirano. Spremanje odabira ne šalje poruku ni ne mijenja prijavnu adresu.

Kad postoji ISSP odluka za odabranu godinu, Studomatov prikaz razine prehrane čita tu odluku i povezuje na detalje ISSP-a. Raniji `student_services/dining` zapisi ostaju sačuvani i koriste se kao raniji prikaz ako ISSP račun još ne postoji. Nova ISSP prava uređuju se u ISSP-u; ranije evidencije ne prenose se automatski.

## Ovlasti i provjere

Student vidi samo svoje zapise. Referada, administrator ustanove i glavni administrator upravljaju prema svojim ovlastima. Nastavnička uloga sama po sebi ne daje pristup ISSP-u, zdravstvenim/financijskim podacima, fotografijama ili obavijestima. Promjena URL-a ne daje dodatnu ovlast. API koristi korisničku sesiju, a ne administratorski Supabase ključ.

Financijske transakcije serijaliziraju se zaključavanjem računa. Izravno pisanje u tablice nije dopušteno prijavljenim korisnicima; sve izmjene idu kroz provjerene RPC-e. Fotografije se dijele kratkotrajnim poveznicama do pet minuta. Prethodno izdana poveznica vrijedi do isteka.

Provjera: `npm test`, `npm run typecheck`, `npm run build -- --webpack`, `npm run db:test:migrate`, `npm run test:migrations`, `npm run test:issp`. `WORKFLOW_PLAYWRIGHT_MODULE` uključuje pravi Chromium. Test koristi isključivo lokalne račune, provjerava privatnost vršnjaka/nastavnika, transakcijske utrke, storna, odbijene datume/prava, PDF i mobilni prikaz, pa uklanja svoje privremene zapise.
