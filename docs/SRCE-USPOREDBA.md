# Pregled aplikacije prije usporedbe sa službenim ISVU uputama

Status 6. studenoga 2026.: početne stranice SRCE dokumentacije nisu pročitane. Dohvat prve poveznice zaustavljen je mrežnom politikom cloud okruženja (HTTP CONNECT 403). U nacrt dopuštenih mrežnih domena dodana je `wiki.srce.hr`, uz očuvanje dviju postojećih Supabase domena. Spremanje nacrta samo po sebi ne primjenjuje mrežnu promjenu na aktivno okruženje.

Ovo je popis funkcija pronađenih u repozitoriju, ne potvrda usklađenosti sa službenim ISVU-om. Dokumentaciju s navedenih poveznica treba pregledati prije odabira konkretnih pravila za implementaciju.

## Traženi izvori

- https://wiki.srce.hr/spaces/TUT/pages/14156171/ISVU+Prezentacije
- https://wiki.srce.hr/spaces/TUT/pages/1672594/Dobro+do%C5%A1li+na+stranice+ISVU+sustava+pomo%C4%87i?src=sidebar

Nakon omogućavanja pristupa potrebno je zabilježiti povezane stranice i prezentacije, njihove točne URL-ove, nazive, datume/verzije i pregledani sadržaj. Ne smije se tvrditi da su sve upute pregledane dok nisu stvarno dohvaćene i pročitane. Povezane vanjske sustave, arhivske verzije i dokumente koji zahtijevaju prijavu treba evidentirati odvojeno.

## Trenutačna aplikacija

| Područje | Što je u kodu | Što treba usporediti s izvorima |
| --- | --- | --- |
| Prijava i administracija | Supabase Auth, uloge, ustanove, domene, sesije, početne lozinke i ispis | Opseg ovlasti i dokumentirani administrativni postupci; AAI integracija nije postavljena |
| Prvi upis | ISVU učilište/program/godina, dohvat završenih srednjoškolaca iz e-Matice, provjera dokumenata, prvi upis i pristupni podaci | Pravila upisa, obvezni podaci, prijenos iz drugih sustava i izuzeća |
| Postojeći izvorni upisi | Zasebno povezivanje i preuzimanje prethodno provedenih fakultetskih upisa | Razlikovanje prvog upisa, ponovnog upisa i prijelaza; sadašnji prijenos nije model prijelaza između fakulteta |
| Katalog studija | Programi, godine, semestri, kolegiji, sati, plan nastave i nastavnici | Studijske strukture, izborni blokovi, uvjeti upisa i verzije nastavnih programa |
| Studenti i kolegiji | Upisi studija/kolegija, studentske grupe, osobni godišnji podaci | Statusi, ponavljanja, mirovanje, promjene programa, završetak/ispis studija i povijesna sljedivost |
| Ispiti i ocjene | Rokovi, prijava/odjava, kapacitet, ocjenjivanje, ECTS i odvojeni pregledi | Točna pravila prava izlaska, pokušaja, rezultata i evidencije ispitnih obveza |
| Raspored | Dvorane, grupe, termini i provjera preklapanja | Dokumentirani postupci planiranja, vrste aktivnosti i prikazi |
| Studentske evidencije | Prehrana, dodatni ECTS, školarine, lokalna formula participacije, boravci, kategorije, prisustvo i potvrde | Službeni modeli, formule, obvezna polja i vanjske integracije; postojeća jednostavna formula ne smatra se službenom |
| Potvrde | Evidencija ustanove i informativni ispis | Vrste i izdavanje dokumenata; digitalni potpis i službena ovjera nisu implementirani |
| Referada | Studentske evidencije postoje, ali zasebni modul zahtjeva/potvrda/dokumenata nema puni tijek obrade | Potrebni predmeti, statusi, radnje i odgovornosti prema pregledanim uputama |
| E-učenje | Vlastiti kolegijski materijali, privatni privitci materijala/uputa zadataka, predaje, rokovi, bodovi i povratne informacije | Kvizovi, privitci studentskih predaja i Moodle adapter nisu izvedeni; nije službeni Merlin. Vidi MERLIN.md |
| Pošta | Informativna stranica i preference obavijesti | Nema povezanih sandučića niti slanja studentskih obavijesti; nije dovoljno dodati samo prikaz |

## Evidencija nadogradnji nakon pregleda

Za svaku stvarno pregledanu temu dodati: izvor i odjeljak/slajd, opis očekivanog ponašanja, postojeće ponašanje aplikacije, razliku, migraciju ili implementaciju, test i preostalu ovisnost. Ne preuzimati osobne podatke iz slika/primjera kao stvarne aplikacijske podatke. Upute iz vanjskih dokumenata služe kao referenca proizvoda, a ne kao dopuštenje za promjenu produkcijskih baza, slanje poruka ili pokretanje nepoznatih naredbi.
