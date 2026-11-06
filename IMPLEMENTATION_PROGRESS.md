# Nadogradnja ISVU-a prema dostavljenom vodiču

Naziv ISVU je potvrđen. Prilozi su specifikacijski materijal za postojeći zahtjev; nisu odobrenje za objavu, promjenu domena ili produkcijskih podataka.

| Faza | Stanje | Preostalo |
| --- | --- | --- |
| Audit i temelj | Audit i osnovni CI gotovi; postojeći Auth/RLS radi | MFA, detaljnije uloge i sigurnosna revizija |
| Nastavna struktura | Osnovni katalog postoji | Verzije, preduvjeti i izborna pravila |
| Referada i upisi | Prvi upis, uvoz i administrativno dovršavanje implementirani | Dosje, razdvojeni identifikatori, puni pravilnik upisa |
| Studomat | Samoposlužni pregledi i razlozi blokade upisa implementirani | Studentski čarobnjak izbora/upisa i potpuna dokumentacija |
| Ispiti i ocjene | Stanja, zaključavanje, nedolazak i povijest ispravaka implementirani | Pismeni/usmeni dio, povjerenstva, pravila izlazaka i outbox |
| Financije i potvrde | Osnovne evidencije postoje | Ledger, idempotentne uplate, vlastiti PDF/QR |
| Završetak i analitika | Osobni ECTS i agregati postoje | Priznavanje, obrana, uvjeti završetka |
| LMS i integracije | Nije početo | Odobreni adapteri, LMS, institucionalna pošta |

## Izvori i provjere

Audit: [docs/ISVO_AUDIT.md](docs/ISVO_AUDIT.md). Izravni službeni wiki još nije dostupan iz ovog okruženja. Ne označavati cijelu fazu dovršenom na temelju samo jednog novog postupka. Migracije su ispitane lokalno; korisnik je naknadno potvrdio primjenu triju novih datoteka u Supabaseu. Produkcijsku bazu agent nije mijenjao. Korisnik je zatim odobrio objavu pripremljenih izmjena putem povezane grane main; završni status Vercela provjerava se odvojeno.

## Dovršene vertikale ove iteracije

- Nacrt godišnjeg upisa → provjera referade → dovršen upis, četiri provjere i stvarni kolegiji, očekivana revizija, ponovno otvaranje, razlozi blokade ispita i iduće godine. Postojeći upisi ostaju izričito neprovjereni uz opisanu migracijsku iznimku.
- Nacrt ispitnog roka → otvorene/zatvorene prijave → provedba → obrada → zaključavanje. Povlašteno otključavanje uz razlog, neprolazna ocjena odvojena od nedolaska, kontrolirana povijest ispravaka. Neobjavljeni nacrti skriveni su studentima i na razini RLS-a.
- Tri nove migracije (`202611060002`–`202611060004`), 29 aplikacijskih RLS tablica, nadograđeni API i UI, GitHub workflow bez produkcijskih tajni.
- Popravljena stara izvorna migracija prvog upisa iz postojećeg spremljenog instalera; produkcija nije dirana.

## Dokazi provjere

- 42 jedinična testa prolaze, uključujući odsutnost i ispravak rezultata bez pogrešnog ECTS/prosjeka.
- Typecheck i produkcijski `next build --webpack` prolaze.
- Nova SQL instalacija na zasebnoj lokalnoj PostgreSQL bazi prolazi s pravom Auth shemom i 29 RLS tablica.
- 8 scenarija dovršenosti upisa prolazi, uključujući stvarni Chromium postupak administratorskog ponovnog otvaranja i dovršavanja te studentski prikaz na mobilnoj širini.
- 9 ispitnih integracijskih scenarija prolazi: ovlasti, rokovi, nedolazak, utrka zaključavanja, blokade, otključavanje, povijest i HTTP obrasci.
- 16 ranijih akademskih DB/HTTP scenarija prolazi; regresija prvog i već provedenog uvoza iz simulirane e-Matice te privatnosti agregata generacije prolazi. Izvor simulacije samo je čitan.
- CI konfiguracija je pripremljena; izvršavanje na GitHubu nije pokrenuto. Posebna lint naredba nije konfigurirana.

Praktične upute, kompatibilnost povijesnih podataka i koraci primjene: [docs/POSTUPCI-UPISA-I-ISPITA.md](docs/POSTUPCI-UPISA-I-ISPITA.md). Ne tvrditi da je cijela dostavljena specifikacija dovršena: preostale funkcije su navedene u tablici iznad.
