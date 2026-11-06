# Radni prostor studentske referade

Naziv proizvoda ostaje ISVU. Sve vrste upisa u ovoj aplikaciji provodi **referada**; administrator ustanove i glavni administrator zadržavaju administrativni pristup. Student i nastavnik ne mogu otvoriti, odobriti ili provesti upis. Dokazi i razlike prema izvorima: [pregled privitaka](ISVU-PRILOZI-REFERADA.md).

## Primjena na postojećoj instalaciji

Nakon ranijih migracija, uključujući `202611060002`–`202611060004`, primijeniti samo:

`supabase/migrations/202611060005_registrar_workbench.sql`

U SQL Editoru koristiti jednu transakciju `begin; … commit;`. Nema reseta ni prepisivanja postojećih upisa, računa, ocjena ili službenih identifikatora. Za novu praznu bazu postoji generirani `supabase/setup.sql`; ne izvršavati ga na postojećoj instalaciji. Migracija je lokalno provjerena, nije automatski primijenjena na produkciju. Nova objava aplikacije na Vercelu zaseban je korak.

Serverska konfiguracija za uvoz i početne podatke ostaje postojeća: javni Supabase URL/ključ te serverski `SVS_SUPABASE_SECRET_KEY`; za vlastitu e-Maticu `EMATICA_SUPABASE_URL` i `EMATICA_SUPABASE_SECRET_KEY`. Tajni ključevi nisu dostupni pregledniku. Dosjei i redovni referadski upis koriste ovlašteni korisnički klijent i RPC, bez administratorskog Auth ključa.

## Gdje otvoriti

**Svi moduli → Studentska referada**, ili na jednoj domeni `/?module=referada`.

- **Pregled**: radni zadaci i broj postupaka/upisa koji čekaju obradu.
- **Upisni postupci**: studentski pristup, priprema, provjera prava upisa i izrada liste kolegija.
- **Uvoz upisa**: prvi upis učenika iz e-Matice ili zasebno preuzimanje već provedenih izvornih upisa. Referada vidi samo vlastite ciljne ustanove i mapiranja.
- **Studenti i dosjei**: matični podaci, odvojeni identifikatori i službeni podaci po akademskoj godini.
- **Studenti i upisi**: godišnji upisni listovi, kolegiji i konačna kontrolna lista dovršenosti.
- **Studentske evidencije**: postojeće evidencije školarine/participacije, prehrane, prisustva, boravaka, kategorija i potvrda.
- **Grupe studenata**: postojeće definiranje grupa, raspoređivanje i popisi studenata.

## Novi student bez računa

Za učenike iz vlastite e-Matice može se koristiti **Uvoz upisa**. U izvornom sustavu ništa se ne mijenja. Referada provjerava maturu i uvjete programa prema stvarnim dokazima; prijava mature nije dokaz prolaza.

Za ostale studente u **Upisni postupci → Novi studentski račun i početni pristup**:

1. Otvoriti studentski poziv na vlastitoj dopuštenoj domeni ustanove. To je korisničko ime i ne stvara e-mail sandučić niti šalje poruku.
2. Potvrditi identitet i **Izradi početne podatke i ispiši**. Podaci se izdaju jednom, uz rezervaciju poziva koja odbija paralelno izdavanje. Korisnik pri prvoj prijavi mora promijeniti inicijalnu lozinku.
3. Ispisati ili spremiti početne podatke prije osvježavanja stranice. Aplikacija ne čuva dohvatljivu običnu lozinku.
4. Osvježiti stranicu i u **Studenti i dosjei** evidentirati službeno ime i ostale potrebne podatke; zatim odabrati novog studenta u upisnom postupku. Popis prikazuje korisničko ime i kad profil još nema ime.

Referada ne može aktivirati poziv za osoblje, preuzeti poziv druge ustanove niti resetirati potvrđen račun. Ako za istu adresu postoji aktivan poziv za nestudentsku ulogu, studentsko izdavanje također se odbija. Potvrđeni postojeći korisnik zadržava lozinku i prihvaća poziv u novu ustanovu postojećim postupkom. Neizvjesno/parcijalno izdavanje ostaje rezervirano za kontroliranu administratorsku provjeru, bez automatskog ponavljanja promjene lozinke.

## Sve vrste upisa

Podržane vrste postupka:

| Vrsta | Provjera |
| --- | --- |
| Prvi upis s državne mature | Prva godina, dokumenti/identitet, položena matura, uvjeti i oznaka odluke |
| Prvi upis s razredbenog postupka | Prva godina, dokumenti, prethodna kvalifikacija i uvjeti postupka |
| Viša godina | Prethodni dovršeni upis istog studenta/programa u ranijoj akademskoj godini; sljedeća nastavna godina |
| Ponavljanje | Prethodni dovršeni upis istog studenta/programa; ista nastavna godina u kasnijoj akademskoj godini |
| Prijelaz | Izvorno učilište/studij i dokumentirana odluka; ne čitaju se tuđi institucionalni dosjei |
| Paralelni studij | Poseban program/godišnji zapis; identitet i lokalni matični broj ostaju isti za tu ustanovu |
| Poslijediplomski studij | Poslijediplomski program, prethodna kvalifikacija, barem jedan semestar, granice i odgovarajuća nastavna godina |
| Nastavak nakon mirovanja/prekida | Prethodni dovršeni godišnji upis i dokumentirana osnova nastavka |

Sve vrste sadrže redoviti/izvanredni način studiranja, financiranje, upisni broj, oznaku odluke i obrazloženje.

### Postupak

1. **Otvori novi postupak** za odabranog studenta, program, akademsku i nastavnu godinu.
2. U pripremi je moguće urediti podatke. Student, program i akademska godina ne mijenjaju se unutar istog postupka; za pogrešan odabir poništiti ga i koristiti odgovarajući zapis.
3. Provjeriti dokumente, uvjete i odgovarajući dokaz mature ili prethodne kvalifikacije. Odabrati **Odobri izradu upisnog lista** uz obrazloženje.
4. Odabrati stvarne obvezne i izborne kolegije odabranog programa i godine te **Izradi upisni list**. Provjera cijelog skupa prethodi transakciji; jedan pogrešan kolegij zaustavlja sve. Dva istodobna zahtjeva ne izrađuju dva upisa.
5. Otvoriti **Studenti i upisi**, provjeriti godišnji upis i odabrati **Dovrši upis u cijelosti** prema prethodno uvedenoj kontrolnoj listi. Samo izrada upisnog lista ne uklanja blokadu ispita.

Postupak ide `draft → approved → enrolled`, uz dopušten povratak u pripremu i poništavanje prije provedbe. Nakon izrade ne briše se povijest postupka niti se poništavanjem obrasca briše student ili godišnji upis. Ispravci godišnjeg upisa koriste postojeći postupak ponovnog otvaranja. Svaka odluka bilježi djelatnika i razlog, a očekivana revizija odbija zastarjeli obrazac.

## Matični i godišnji podaci

`student_records` čuva institucionalni matični dosje. `local_number` generira se zasebno i ne mijenja se običnim uređivanjem. `admission_number` pripada konkretnom upisnom postupku. JMBAG i OIB opcionalno se prenose iz provjerenog izvora s oznakom provjere; nisu izvedeni iz upisnog ili lokalnog broja. Provjerava se format i jedinstvenost unutar ustanove, ne nacionalni registar ili kontrolna znamenka.

`student_year_records` čuva službeno prebivalište, adresu, datum potvrde, stanovanje i ostale godišnje podatke. Prije prvog godišnjeg upisa nije moguće spremiti službeni godišnji zapis. Potvrda prebivališta ne kopira se automatski iz stare godine kao novoprovjerena. Postojeći `student_reports` ostaje samoprijava, jasno odvojena od službenih podataka.

Student vidi vlastite **Matične podatke** i **Službene godišnje podatke** u Studomatu. Nema obrazac za njihovo mijenjanje. Internu povijest i upisne odluke čitaju ovlašteni djelatnici. Nastavnik nema pristup tim službenim osobnim podacima.

## Što ovo ne automatizira

Uvjeti programa izričito se potvrđuju ljudskom provjerom i oznakom odluke. Još nema cjelovitog verzioniranog mehanizma ECTS/preduvjeta, zaključavanja kataloga/kalendara, kvota izbornih blokova, svih PDS pravila semestara/ponavljanja, punog priznavanja ili završetka/diplomiranja. Postojeće školarine i potvrde evidencije su; nisu potpuna financijska knjiga niti certificirane e-potvrde. Vanjski službeni sustavi nisu automatski povezani. Popis daljnjeg rada: [IMPLEMENTATION_PROGRESS.md](../IMPLEMENTATION_PROGRESS.md).

## Provjera lokalno

```sh
npm run db:test:migrate
npm test
npm run test:migrations
npm run build -- --webpack
npm run typecheck
npm run test:registrar
npm run test:ematica
```

`test:registrar` koristi lokalni Supabase, sintetske račune i vlastiti Next na portu 3010; nakon testa uklanja samo svoje podatke. Za puni Chromium postupak postaviti `WORKFLOW_PLAYWRIGHT_MODULE` na instalirani playwright-core modul. Test provjerava svih osam vrsta, izolaciju ustanove, službene podatke, početni pristup, zabranu aktivacije osoblja i stvarne web obrasce.
