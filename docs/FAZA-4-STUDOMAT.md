# Prošireni Studomat i studentske evidencije

Implementacija koristi priložene snimke kao referencu funkcionalnih područja. Ne prenosi osobne podatke, fotografije, ocjene, ustanove ni službene oznake sa snimki. Dizajn ostaje unutar postojeće ISVU aplikacije.

## Aktivacija

Na postojećem SVS projektu primijenite samo nedostajuće migracije redom, zaključno sa `supabase/migrations/202611020004_student_services.sql`. Ne pokrećite cijeli `setup.sql` na postojećoj bazi. Za novi projekt regenerirani `supabase/setup.sql` uključuje sve migracije. Migracija 004 dodaje dvije tablice s RLS pravilima, metapodatke kolegija, kontakt/upute ustanove i agregat generacije. Ne dodaje produkcijske korisnike ni testne podatke.

Nakon objave aplikacije glavni administrator u **Administracija sustava → Studentske evidencije**, odnosno administrator ustanove/referada u **Administracija studija → Studentske evidencije**, unosi podatke odabirom ustanove, studenta i akademske godine. Administrator vlastite ustanove ne može uređivati tuđe ustanove. Student ne može sam dodjeljivati prava, bodove, financijske obveze ili potvrde. Nastavnici nemaju pristup ovim osobnim/financijskim evidencijama; prisustvo u ovoj verziji unosi administrator ili referada.

U **Ustanove → Uredi ustanovu** postavljaju se kontakt referade, studentske upute i opcionalna HTTPS poveznica na identitetski portal. U uređivanju kolegija postavljaju se sati predavanja/vježbi, izborna grupa i plan nastave. Podržani su i kolegiji s 0 ECTS bodova.

## Funkcionalna područja

| Područje | Ponašanje |
| --- | --- |
| Ispiti | Odvojene stranice za prijavu, odjavu, prijavljene neocijenjene ispite, rokove i povijest. Koriste postojeću registraciju i serverska/DB ograničenja rokova, kapaciteta i ovlasti. |
| Osobni podaci | Student sprema podatke o stanovanju, osiguranju, uzdržavatelju i roditeljima zasebno za svaku akademsku godinu; ne mijenja svoju ulogu ili službeni status studija. |
| E-mail opcije | Student sprema kontaktnu adresu i preferencije obavijesti zasebno po akademskoj godini. To ne mijenja Auth korisničko ime i ne šalje poruke. Za buduće slanje prvo treba implementirati provjeru kontaktne adrese i pružatelja dostave. |
| Račun ustanove | Poveznica na upravljanje vlastitim ISVU računom i opcionalni identitetski portal ustanove. Nema automatske AAI@EduHr integracije. |
| Pregled studiranja | Osobni i težinski prosjek položenih kolegija, položeni/upisani kolegiji, ECTS i prikaz napretka. Isti položeni kolegij računa se jednom po šifri; ocjena 1 i tuđe ocjene ne daju bodove. |
| Generacija | Autorizirani agregat za isti program i akademsku godinu, dostupan tek uz barem pet studenata. Ne otkriva pojedinačne rezultate drugih studenata. Osobne brojke u usporedbi koriste isti studij/godinu; ukupna statistika ostaje zasebno. |
| Godine i predmeti | Prikaz upisa i aktivnih nepoloženih kolegija, detalji predmeta, sati, ECTS, izborna grupa, plan i termini nastave, osobno prisustvo i ocjene ispita. |
| Dodatni ECTS | Administrator evidentira aktivnost, bodove, datum i odluku. Ista oznaka odluke za istog studenta/ustanovu ne može se ponovno pribrojiti. Bodovi ulaze u ukupan studentski ECTS, zasebno od položenih kolegija. |
| Prehrana | Evidencija razine prava i razdoblja valjanosti koju unosi ustanova. Nije povezana sa službenim sustavom subvencionirane prehrane. |
| Školarine | Obveza, uplata, dospijeće i preostali iznos iz evidencije ustanove. Nema naplate niti automatskog bankovnog usklađivanja. |
| Participacije | Transparentan izračun iz izričito unesenih parametara ustanove i obrazloženja. Ne pretpostavlja zakonski obrazac niti automatsku subvenciju. |
| Boravci i kategorije | Evidencija ustanove, države, svrhe i razdoblja boravka, odnosno kategorije i pripadajuće odluke. |
| Potvrde | Prikaz i ispis potvrda evidentiranih od strane ustanove. Ispis je evidencija aplikacije i nije digitalno potpisana službena isprava. |
| Upute i kontakt | Stvarni tekstovi koje postavlja administrator ustanove; za prazne postavke prikazuje se jasna poruka. |

Svi novi pregledi imaju prazna stanja. Nema izmišljenih službenih prava ni automatskih veza prema AAI@EduHr, SRCE/ISSP ili poštanskom sustavu. Te integracije trebaju zasebno ovlaštenje i tehničku konfiguraciju.

## Formula participacije

Za ovu aplikacijsku evidenciju koristi se:

`iznos = min(puni iznos, maksimalni iznos, cijena ECTS × ECTS za obračun) × (1 − umanjenje / 100)`

Rezultat se zaokružuje na dva decimalna mjesta. Vrijednosti i obrazloženje unosi referada prema stvarnoj odluci ustanove. Umanjenje od 100% daje nulu. Formula je izričito opisana; ne predstavlja preuzeti nacionalni propis. Složenija zakonska pravila i dodatni kriteriji sa snimki ne zaključuju se automatski iz osobnih podataka.

## Provjere

- `npm test`: granice iznosa i datuma, valjanost ECTS-a/uplata/prisustva i osobnih postavki, osobni i težinski prosjek uz deduplikaciju.
- `npm run test:migrations`: puna instalacija na čistoj testnoj bazi; sve 23 aplikacijske tablice imaju RLS.
- `npm run test:student-services`: uz lokalni profil i aplikaciju na portu 3006 (ili `AUTH_TEST_PORT`) provjerava svih osam vrsta evidencija putem HTTP obrazaca, osobne podatke/preferencije, 20 studentskih stranica, detalje predmeta, izračune i zabranu studentu/nastavniku/drugoj ustanovi.
- `npm run test:student-cohort`: izdvojeni lokalni podaci provjeravaju skrivanje agregata za 1–4 studenta te točne ECTS i brojeve kolegija za pet studenata, bez izmišljene ocjene kada nema rezultata.

Testovi ne koriste produkcijske ključeve ni stvarne podatke. Preglednički su provjereni prijava, početna statistika, otvaranje detalja kolegija, osobni obrazac i širina 390 px. Izgradnja je lokalno provjerena s `npx next build --webpack`; TypeScript s `npm run typecheck`.
