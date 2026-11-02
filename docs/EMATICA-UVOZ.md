# Uvoz iz vlastite e-Matice

Serverski administratorski alat koristi stvarnu shemu repozitorija `nikolad4487-cell/eskolehr-ematica`: `student_school_enrollments` s `status=ACTIVE`, povezane `schools.education_level=HIGHER` i `registry_students`. Ne uvozi liste želja ni samu prihvaćenu prijavu prije stvarnog aktivnog upisa. Iz e-Matice čita samo identifikatore, ime i prezime; ne prenosi OIB, adrese, postojeće lozinke ni PIN-ove. Izvor se ne mijenja.

Ovo je ručno pokretan serverski uvoz, a ne automatska sinkronizacija ili novi gumb u administratorskom sučelju. Produkcijski projekti još moraju biti povezani. Adresa web-aplikacije `e-matica.skolehr.xyz` nije adresa Supabase API-ja: nju provjerite u e-Matica Vercel varijabli `VITE_SUPABASE_URL` ili u Supabase postavkama projekta.

## Priprema

1. U SVS primijenite nedostajuće migracije redom, uključujući `202611020001_email_domains.sql` i `202611020002_import_passwords.sql`. Za novi projekt koristite regenerirani `supabase/setup.sql` jednom. Nemojte pokretati puni installer na postojećoj bazi.
2. U SVS kreirajte ustanove, studijske programe i akademske godine te dopuštene domene ustanova. Ne zaključujemo identitet fakulteta prema sličnom nazivu: potrebno je izričito mapiranje identifikatora.
3. Na sigurnom serverskom izvršitelju postavite `EMATICA_SUPABASE_URL`, `EMATICA_SUPABASE_SECRET_KEY`, `SVS_SUPABASE_URL`, `SVS_SUPABASE_SECRET_KEY`. URL-ovi su javni; oba ključa su administratorski Supabase secret/service-role ključevi. Nikad ih ne stavljajte u `NEXT_PUBLIC_*`, `VITE_*`, Git, chat ili preglednik. Ključevi moraju imati pristup relevantnim tablicama, a SVS ključ i Auth Admin API-ju. Za proxy pohranu tajni ograničite svaki ključ na njegov točan Supabase hostname. Izvršitelj mora imati mrežni pristup tim dvama hostnameovima. Nema novih ključeva za unos u frontend e-Matice.
4. Pripremite JSON mapiranje, primjerice `/workspace/ematica-mapping.json`, s jednim zapisom po kombinaciji izvornog fakulteta, programa i školske godine:

```json
[
  {
    "school_id": "ID-FAKULTETA-U-EMATICI",
    "program_id": "00000000-0000-4000-8000-000000000001",
    "school_year_id": "00000000-0000-4000-8000-000000000002",
    "institution_id": "00000000-0000-4000-8000-000000000003",
    "svs_program_id": "00000000-0000-4000-8000-000000000004",
    "academic_year_id": "00000000-0000-4000-8000-000000000005",
    "domain": "studenti.fakultet.example",
    "study_year": 1
  }
]
```

Zamijenite sve primjere stvarnim identifikatorima i domenom. `school_id` je tekstualni identifikator; ostali identifikatori su UUID. Alat dohvaća samo navedene fakultete i izvorne godine. Za njihove aktivne upise traži točno jedno mapiranje; nedostajuće ili dvostruko mapiranje zaustavlja cijeli pregled prije spremanja. Upisani programi, godine i domene moraju pripadati ciljnoj ustanovi.

## Izvršenje

Iz `/workspace/svs`, nakon `npm ci`:

```sh
# Samo pregled: ne stvara račune, pozive, članstva ni upise.
npm run import:ematica -- --config /workspace/ematica-mapping.json
# Administratorski odobren uvoz; datoteka mora biti nova i izvan repozitorija.
npm run import:ematica -- --config /workspace/ematica-mapping.json --apply --credentials /workspace/novi-svs-racuni.jsonl
```

Korisničko ime je oblika `ime.prezime.<stabilni-sufiks>@domena`. Sufiks iz izvornog identifikatora razlikuje učenike istog imena. Jedan izvorni učenik u jednoj ciljnoj ustanovi dobiva jedan račun i može imati više upisa; druga ustanova dobiva zaseban račun s vlastitom domenom. Promjena imena ili domene koja bi preimenovala postojeći račun traži ručnu provjeru. Tuđi postojeći račun s istom adresom nikad se automatski ne preuzima.

Za novi račun alat stvara administratorski poziv za ulogu student i generira novu nasumičnu lozinku. Aktivacija identiteta je privilegirana administratorska radnja temeljena na provjerenom izvornom upisu; ne šalje se lažna potvrda e-pošte i ne tvrdi se da korisnik posjeduje novi sandučić. Alat ne stvara e-mail sandučiće. Privremena lozinka omogućuje samo promjenu lozinke; aplikacija i DB RLS blokiraju studijske podatke do promjene. Promjena kroz aplikaciju opoziva postojeće sesije.

Lozinke se ne ispisuju u konzolu ni spremaju u bazu aplikacije. Izlazna JSONL datoteka ima dozvole 0600: zapis `candidate` sadrži generiranu lozinku i zapisuje se prije udaljenog poziva, a zapis `created` potvrđuje stvoren račun. Sam `candidate` ne dokazuje da je račun stvoren. Administrator mora podatke dostaviti sigurnim kanalom nakon provjere identiteta, zatim ukloniti datoteku kada više nije potrebna. Ne dijelite zajednički popis sa studentima.

Ponovni uvoz prepoznaje vezu u zaštićenom Auth `app_metadata`, ne mijenja lozinke i ne duplicira postojeći upis. Ne mijenja postojeći status ili godinu studija. Uvoz ne briše račune, ne opoziva članstva i ne obrađuje ispisane studente. Nije jedna transakcija preko dvaju projekata: pri prekidu zadržite izlaznu datoteku i ponovite pregled pa uvoz s novom izlaznom putanjom. Djelomično stvoren račun može se dopuniti članstvom/upisom bez promjene lozinke. Nemojte pokretati više uvoza istodobno.

## Provjere

`npm test` provjerava normalizaciju imena, stabilna različita korisnička imena, odabir aktivnih upisa i odbijanje nejasnog mapiranja. `npm run test:ematica` koristi simulirani izvor sa stvarnim formatom e-Matice te stvarnu lokalnu SVS bazu i Auth: provjerava pregled, izradu računa, datoteku 0600, blokadu podataka do promjene lozinke, članstvo/upis i ponovni uvoz bez promjene lozinke. Potrebni su pripremljeni lokalni testni servisi, akademski fixture podaci i izgrađena aplikacija pokrenuta na portu 3002 (ili `AUTH_TEST_PORT`). Test provjerava i HTTP preusmjeravanje na promjenu lozinke, zabranu izmjene profila prije promjene te opoziv starih sesija. To nije potvrda pristupa udaljenoj e-Matici.


## Ispis podataka za prvu prijavu

U aplikaciji otvorite **Administracija sustava → Ispis podataka za prvu prijavu**, odaberite `.jsonl` datoteku iz parametra `--credentials` dovršenog uvoza i kliknite **Ispiši / Spremi kao PDF**. Svaki potvrđeno izrađen račun dobiva zaseban A4 list, s imenom, ustanovom, adresom prijave, korisničkim imenom i inicijalnom lozinkom. Stariji izvozi bez imena/ustanove također su podržani. Nepotvrđeni `candidate` zapisi se ne ispisuju. Datoteka ostaje u pregledniku; ne šalje se aplikacijskom poslužitelju niti se sprema u localStorage.

Lozinka se preuzima iz izvornog izvoza i ispis ne mijenja račun ni lozinku. Ako je korisnik već promijenio inicijalnu lozinku, stari ispis je više ne može zamijeniti. Sustav ne može pročitati trenutne lozinke iz Supabasea. Gumb **Ukloni podatke iz pregleda** uklanja učitane podatke iz prikaza; ne briše izvornu datoteku ni spremljeni PDF. Listove uručite pojedinačno odgovarajućim korisnicima. Korisniku je promjena inicijalne lozinke obvezna pri prvom pristupu.
