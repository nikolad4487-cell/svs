# Provjera upisa i ispitni postupak

## Migracije i objava

Za postojeću bazu s ranije primijenjenim migracijama pokrenuti redom samo nove datoteke:

1. `supabase/migrations/202611060002_exam_workflow.sql`
2. `supabase/migrations/202611060003_enrollment_completion.sql`
3. `supabase/migrations/202611060004_grade_history.sql`

Svaku u produkcijskom SQL Editoru izvršiti u vlastitoj transakciji (`begin; … commit;`). Prije toga napraviti uobičajenu sigurnosnu kopiju. Ove migracije nisu automatski primijenjene na produkciju. `supabase/setup.sql` namijenjen je samo potpuno novoj bazi. Obnovljena je i datoteka `202611060001_first_enrollment.sql` iz već pohranjenog instalera: ranije je u repozitoriju sadržavala samo tekst `migra`. Ako je taj korak već primijenjen iz ispravnog instalera, ne ponavljati ga.

Nakon migracija objaviti aplikaciju u postojećem Vercel projektu. Nema novih environment varijabli, DNS promjena ili vanjskih integracija. Bez novih tablica postojeći zasloni rade uz poruku o nedostajućoj migraciji; nove radnje nisu dostupne.

## Referada: dovršavanje godine

1. U **Administracija studija → Studenti i upisi** (superadministrator i u Administracija sustava) dodati godišnji studij i njegove kolegije. Uvoz prvog upisa iz e-Matice stvara nacrt; prethodno odobrenje prijenosa nije zamjena za dovršen upisni list.
2. U dijelu **Dovršenost godišnjih upisa** otvoriti studenta i godinu te odabrati **Započni provjeru upisa**, uz obrazloženje.
3. Provjeriti identitet/pravo upisa, dokumentaciju, obvezne i izborne kolegije te financiranje prema vlastitim pravilima ustanove. Označiti samo stvarno provjerene stavke. Nedovršenu provjeru moguće je spremiti.
4. Kad je sve provjereno i upisan barem jedan kolegij, odabrati **Dovrši upis u cijelosti**. Baza bilježi provjeravatelja, datum, reviziju i događaj u istoj transakciji.
5. Za ispravak predmeta ili osnovnih godišnjih podataka najprije **Ponovno otvori provjeru**. Time se ponovno blokiraju nove prijave ispita. Postojeću prijavu student smije odjaviti do roka. Aktivni/mirovanje/završen status studija ostaje zaseban podatak; ovaj postupak ne izdaje diplomu.

Student vidi vlastiti status, provjerene stavke i razlog blokade u **Studomat → Podaci o studiranju → Dovršenost upisa**. Ne vidi interne razloge iz povijesti referade. Nema samostalnog dovršavanja ili dodjele uloga.

Prethodni nedovršeni upis na istom programu blokira otvaranje kasnije akademske godine. Otkazani prethodni upisi ne blokiraju novu godinu; to nije implementacija potpunih pravila napredovanja, ECTS pragova ili ponavljanja. Za njih slijedi verzionirani pravilnik programa.

### Zatečeni upisi

Dobivaju `legacy_unverified`, ne `completed`. Raniji pristup ispitima ostaje dostupan dok referada ne pokrene provjeru. To je izričita migracijska iznimka; za kasniji godišnji upis i njih treba verificirati. Ne označavati stare zapise dovršenima masovnim SQL-om bez stvarne provjere.

## Nastavnik i referada: ispitni rok

**Administracija studija → Ispitni rokovi** sadrži unos termina i dio **Obrada i zaključavanje ispitnih rokova**. Nastavnik svojih kolegija isti postupak ima u **Studomat → Nastavnici → Ocjenjivanje**.

`draft → open → registration_closed → in_progress → grading → locked`

- Novi rok je nacrt; otvoriti ga uz obrazloženje prije isteka roka prijave.
- Student se prijavljuje samo na otvoren rok; odjava je moguća i nakon zatvaranja prijava, do vlastitog roka odjave, prije početka obrade.
- Ispit u tijeku i obrada ne mogu započeti prije vremena početka ispita.
- U obradi za svaku važeću prijavu unijeti ocjenu 1–5 ili **Nije pristupio/la**. Nedolazak ima `grade=NULL`, ne znači jedinicu i ne donosi ECTS.
- Zaključavanje je moguće tek nakon obrade svih važećih prijava. Nakon toga nije moguće mijenjati ni termin, ni rezultat, ni prijavu niti običnim brisanjem ukloniti rok.
- Samo administrator ustanove ili referada mogu **Otključati za ispravak**, uz obvezno obrazloženje. Nastavnik zatim može ispraviti svoj rezultat u stanju obrade i ponovno zaključati rok.
- Dva istodobna zahtjeva provjeravaju očekivano stanje i zaključavaju isti redak baze. Drugi dobiva poruku za osvježavanje; nema dvostrukog događaja.

Postojeći rokovi ostaju otvoreni s `legacy_workflow=true` i ranijim načinom ocjenjivanja. Prva promjena stanja trajno ih uključuje u novi postupak. Zaključavanje se uvijek provodi kroz obradu svih prijava.

## Povijest i pristup

| Evidencija | Ovlašteni čitatelji | Izmjene običnim API-jem |
| --- | --- | --- |
| `exam_workflow_events` | Administrator/referada iste ustanove i nastavnik odgovarajućeg kolegija | Nisu dopuštene |
| `enrollment_completion_events` | Administrator/referada iste ustanove | Nisu dopuštene |
| `exam_grade_events` | Student za vlastite rezultate i ovlašteno osoblje ispita | Nisu dopuštene |

Povijest ocjena prikazuje se u **Ocjenjivanje** i studentovu **Pregledu ispita**. Početni `BASELINE` bilježi samo zatečeni rezultat; ne rekonstruira nepoznatu povijest. Svaki kasniji unos/ispravak čuva stari i novi ishod te vezu s postupkom roka. Slobodni feedback, dokumenti i lozinke nisu dio tih događaja ni općeg audita.

Administrativni ključevi ostaju privilegirani: vlasnik PostgreSQL-a može provesti posebno održavanje. Zabrane u dokumentu odnose se na aplikacijske uloge i RPC/API, ne na nemogućnost intervencije vlasnika baze.

## Lokalna provjera

Node.js 24, Docker i pripremljen lokalni Supabase profil:

```sh
npm ci
npm run db:test:start
npm run db:test:migrate
npm run db:seed-users
npm run db:seed-academic
npm test
npm run test:migrations
npm run build -- --webpack
npm run typecheck
npm run test:enrollment-completion
npm run test:exam-workflow
```

Integracijske skripte zahtijevaju lokalni URL i koriste sintetske zapise koje uklanjaju nakon testa. Same pokreću i gase lokalni Next na portovima 3009 i 3008. Seeder sadrži namjerne povijesne fixture za provjeru kompatibilnosti; nove skripte odvojeno provjeravaju nove nacrte i sve prijelaze. Za opcionalni Chromium test postaviti `WORKFLOW_PLAYWRIGHT_MODULE` na instalirani `playwright-core` modul; Chromium je očekivan na `/usr/bin/chromium`.

GitHub workflow provjerava jedinične testove, build, tipove i dosljednost generiranog SQL instalera. Docker/Supabase integracijski testovi ostaju lokalni; CI još ne pokreće cijeli servisni skup. Poseban lint alat trenutačno nije konfiguriran u projektu.
