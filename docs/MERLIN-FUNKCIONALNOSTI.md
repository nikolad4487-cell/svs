# Merlin unutar ISVU-a: izvedeni opseg i sljedeće nadogradnje

Korisnik želi funkcije i preglednost sustava poput Moodlea unutar vlastite aplikacije. Ova iteracija donosi stvarne nove prikaze i osnovne kvizove, ali nije instalacija Moodlea niti potpuna zamjena za sve njegove module/dodatke.

| Područje | Izvedeno | Preostalo |
|---|---|---|
| Radni prostor | Zaseban Merlin izgled, mobilna navigacija, kartice kolegija, pretraživanje, ustanova/godina, omiljeni na uređaju | Omiljeni i postavke sinkronizirani među uređajima, personalizirani blokovi |
| Pristup | Ista ISVU prijava, stvarni kolegiji, aktivni studentski upisi i nastavničke dodjele | Gosti i samostalni upisi prema pravilima ustanove |
| Organizacija | Pregled kolegija, izbornik aktivnosti, odvojeni materijali/zadaci/kvizovi | Nastavne teme/tjedni, povlačenje redoslijeda, preduvjeti i uvjetna dostupnost aktivnosti |
| Materijali | Tekst, HTTPS poveznice, slike, video i privatni dokumenti; nacrti i objava | Bogati uređivač teksta, višestranične lekcije, uređivanje medija |
| Zadaci | Upute i privitci, rokovi, zakašnjenja, tekstualne predaje/poveznice, bodovi i komentari | Izravni privitci studentskih radova, grupne predaje, rubrike, više verzija i označavanje PDF-a |
| Kvizovi | 1–20 pitanja s jednim točnim odgovorom, 2–6 opcija, ponderirani bodovi, datumi dostupnosti, jedan pokušaj, server bodovanje i privatni rezultati | Banka i kategorije pitanja, slučajni odabir, više točnih odgovora, kratki odgovori, eseji, numerička pitanja, odbrojavanje, autosave, više pokušaja i povijest |
| Bodovi | Pregled zadataka i kvizova; student vidi svoje, osoblje svoj kolegij | Ponderirana završna ocjena kolegija, skale, kategorije, ručne stavke, izvoz i kontrolirana sinkronizacija sa službenim ispitima |
| Napredak | Stvarni broj predanih zadataka | Praćenje čitanja, dovršenost aktivnosti, uvjeti završetka kolegija, značke i certifikati |
| Rokovi | Datumi zadataka i otvaranja/zatvaranja kvizova u kolegiju | Mjesečni kalendar, događaji i pregled svih kolegija, podsjetnici |
| Komunikacija | Povratna informacija uz zadatak | Forumi, rasprave, objave unutar LMS-a, privatne poruke i moderiranje |
| Sadržaj i integracije | Stabilni ISVU identifikatori i opcionalna Gnomio poveznica | Moodle API/SSO, uvoz/izvoz tečaja, SCORM, H5P, LTI i dodaci |

## Nova migracija

`202611100001_learning_quizzes.sql` primijeniti nakon ranijih ISVU/Merlin migracija. Dodaje četiri tablice s RLS-om. Ključ odgovora odvojen je od studentski dostupnih pitanja, a objava, dostupnost, revizija, broj pokušaja i bodovanje provjeravaju se na serveru. Ne mijenja službene ispitne ocjene, ECTS, poštu ili Gnomio račune.

## Provjere ove iteracije

57 jediničnih testova, TypeScript provjera i produkcijska webpack izgradnja. Nova SQL instalacija ima 41 aplikacijsku tablicu s RLS-om. Osam novih DB/HTTP/Chromium scenarija provjerava ovlasti, skriveni ključ odgovora, datume, istodobne predaje, bodovanje, privatnost vršnjaka, zaključavanje pitanja, izradu/rješavanje u pregledniku, filtre, omiljene i mobilni raspored. Prolaze i raniji testovi privitaka, predaja, prijave i domena.

Snimke izgleda izrađene su lokalno s testnim računima i aktivnostima. Testovi ne stvaraju produkcijske račune, ne objavljuju stvarne studentske rezultate i ne predstavljaju potvrdu završene Vercel objave.
