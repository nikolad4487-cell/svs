# Audit nadogradnje ISVU-a — 6. studenoga 2026.

Naziv datoteke prati dostavljenu specifikaciju. Naziv proizvoda ostaje **ISVU – Informacijski sustav visokih ustanova**, prema izričitoj odluci vlasnika. Ovo je vlastita aplikacija, bez službenog statusa ili integracije sa Srcem.

## Pregledani materijali

README, package.json, rute i proxy, autorizacija, akademski modeli/servisi/komponente, migracije i lokalni testni alati te dostavljeni PDF `ISVU_veliki_vodic_i_ISVO_arhitektura.pdf` i `Codex_prompt_ISVO_nadogradnja.md`. PDF je neslužbena sinteza; sam navodi da nisu otvoreni svi prezentacijski privici. Mrežna politika još blokira izravan pristup wiki.srce.hr. Ne tvrdimo da smo provjerili sve službene prezentacije, slike ili važeća nacionalna pravila.

## Stanje prije nadogradnje

| Područje | Postoji | Nedostaje |
| --- | --- | --- |
| Temelj | Next.js App Router/TypeScript, Tailwind, Host whitelist i query fallback, Vercel konfiguracija | CI, potpuna pristupačnost i engleski prijevod |
| Identitet | Supabase Auth, pozivi i dopuštene domene, opoziv sesija, prisilna promjena inicijalne lozinke | MFA, dodatne granularne službene uloge i odobreni vanjski SSO |
| Izolacija | institution_id, složeni FK, serverske ovlasti, RLS na 26 tablica, audit metapodataka | Povijest domenskih odluka s razlozima |
| Upis | Program/godina, student_studies kao godišnji upis, kolegiji, kontrolirani prvi upis iz vlastite e-Matice | Zasebno administrativno dovršavanje, verzionirani predmetnik, dosje i razlikovanje identifikatora |
| Studomat | Vlastiti kolegiji, ECTS, ispiti, studentske evidencije i izvještaji | Potpun postupak upisa godine i dokumenti s provjerom |
| Ispiti | Rokovi, kapacitet, prijava/odjava, provjera ranijeg prolaza, ocjene kroz RPC | Stanja roka, zaključavanje, razlog otključavanja, odsutnost kao zaseban ishod |
| Nastava | Nastavnici, grupe, raspored s kolizijama, plan nastave | Verzije programa, formalni preduvjeti i izborna pravila |
| Financije | Administrativna evidencija školarine/participacije | Knjiga transakcija, uplate, idempotencija, rate |
| Ostalo | Evidencije mobilnosti i potvrda | Priznavanje, završni rad/obrana/diploma, puni LMS, poštanski pružatelj |

## Rizici i plan

- Sačuvati račune, rute i podatke; dodavati migracije bez reseta ili automatske produkcijske primjene.
- Postojeće ispite zadržati otvorenima zbog kompatibilnosti; novi rokovi počinju kao nacrti. Povijesnim upisima ne pripisivati nepostojeću administratorsku provjeru.
- Zaključavanje i promjene ocjena moraju dijeliti zaključavanje retka u PostgreSQL-u, uz zaštitu i od izravnog API pristupa. Domenski događaji su samo za čitanje korisnicima i ograničeni po ustanovi/predmetu.
- Najprije dovršiti jednu vertikalu ispita (SQL, API, UI, audit, integracijski test), zatim kontrolnu listu upisa i verzioniranje programa. U ovoj iteraciji završeni su stanja/zaključavanje ispita, povijest rezultata i kontrolna lista upisa; verzioniranje programa ostaje sljedeći temeljni korak. Financije i završetak dolaze nakon stabilnih akademskih pravila.
- Nacionalni pragovi, službeni JMBAG i vanjski endpointi ne izvode se iz pretpostavki. Lokalni student_number nije JMBAG.
- Produkcijska migracija i objava su odvojeni koraci; ovaj rad priprema pregledive lokalne izmjene.

Stanje pojedinih faza i dokazi provjere: [IMPLEMENTATION_PROGRESS.md](../IMPLEMENTATION_PROGRESS.md).
