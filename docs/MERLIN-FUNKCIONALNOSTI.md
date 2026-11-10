# Merlin: izvedene funkcije i preostali Moodle postupci

Vlastiti ISVU modul nadograđen je prema korisnikovim slikama i priloženom **Moodle_prirucnik_sve_uloge_HR.pdf** (21 stranica, neslužbeni praktični vodič, studeni 2026.). Dokument i slike služe kao funkcionalna referenca. Ovo nije instalacija Moodlea ni implementacija svih njegovih dodataka.

| Područje | Izvedeno | Preostalo |
|---|---|---|
| Osobna stranica | Kartice/popis, pretraga, ustanova/godina, poredak, omiljeni na uređaju, vremenska crta stvarnih rokova | Sinkronizacija osobnih postavki, prilagodljivi blokovi, obavijesti |
| Pristup | ISVU prijava, stvarni kolegiji, aktivni studentski upisi i nastavničke dodjele | Gosti, kohorte, dodatne kontekstne uloge |
| Organizacija | Indeks, sklopive cjeline, opis, skrivanje, strelice za redoslijed cjelina i miješanih aktivnosti, premještanje aktivnosti, brisanje praznih cjelina | Tjedni format s datumima, povlačenje mišem, preduvjeti i uvjetna dostupnost |
| Uređivanje | Prekidač za ovlašteno osoblje; dijalog aktivnosti s pretragom i filtrima | Skupne radnje, dupliciranje, koš i vraćanje obrisanih aktivnosti |
| Resursi | Datoteka, mapa privitaka, stranica, tekst i mediji, HTTPS poveznica; slike/video/privatni dokumenti | Podmape, knjiga i višestranična lekcija, snimanje zvuka/videa |
| Tekst | Uređivač oblikovanja, naslovi/popisi/citati/poveznice/poništavanje, siguran strukturirani prikaz | Tablice, ugrađene slike u tekstu, formule i napredni medijski uređivač |
| Zadaci | Oblikovane upute, nastavnički privitci, rokovi/zakašnjenja, studentske tekstualne predaje/poveznice, bodovi/komentari | Studentski prijenos datoteka, nacrt/konačna predaja, grupni rad, rubrike, verzije i PDF anotacije |
| Kvizovi | 1–20 pitanja s jednim točnim odgovorom, 2–6 opcija, bodovi, datumi, jedan pokušaj, serversko bodovanje i privatni rezultati | Banka pitanja, druge vrste, slučajni odabir, odbrojavanje, autosave, više pokušaja |
| Bodovi | Zajednički pregled zadataka i kvizova; vlastiti rezultati studenta, kolegij nastavnika | Ponderi, kategorije ocjena, skale, ručne stavke i izvoz |
| Napredak | Broj predanih zadataka i postojeći rezultati | Dovršenost, uvjeti završetka, značke i certifikati |
| Komunikacija | Povratne informacije uz zadatak | Forumi, objave, poruke, moderiranje i radionice |
| Administracija | Službeni ISVU kolegiji, ustanove, godine, nastavnici i upisi u postojećoj administraciji/referadi | Zasebna hijerarhija LMS kategorija, CSV uvoz kolegija i administracija prema Moodle prikazima |
| Integracije | Stabilni ISVU identifikatori, opcionalna Gnomio poveznica | Moodle API/SSO, .mbz arhive, SCORM, H5P, IMS, LTI i drugi dodaci |

## Pokrivenost dostavljenih slika

Osobna stranica odgovara primjeru pregleda kolegija i rokova. Prikaz kolegija prati indeks, sklopive cjeline, način uređivanja i dijalog aktivnosti. Oblikovani uređivač koristi se u materijalima i uputama zadataka. Administracija kategorija, CSV uvoz, višestranične lekcije i ostale vrste iz Moodleova izbornika ostaju zasebne nadogradnje; njihove nefunkcionalne tipke nisu dodane.

Upis svih vrsta studenata ostaje u referadi. Dodavanje nastavne aktivnosti ne dodaje studentski upis i ne stvara novi službeni kolegij. Bodovi e-učenja ne mijenjaju službene ispitne ocjene ni ECTS.

## Migracije i provjere

Nova migracija **`202611100002_learning_sections.sql`** primjenjuje se nakon **`202611100001_learning_quizzes.sql`** u ISVU projektu. Postojeći sadržaj nije obrisan; bez migracije ostaju dostupne prethodne kartice sadržaja, uz obavijest ovlaštenom osoblju.

Provjere: jedinični testovi, TypeScript, produkcijska izgradnja, čista SQL instalacija sa 42 RLS tablice, testovi osnovnog e-učenja, privitaka, kvizova i cjelina. Testovi rade s lokalnim računima i privremenim sadržajem. Snimke služe za pregled izgleda; ne potvrđuju dovršenu Vercel objavu ni stanje produkcijskih migracija.
