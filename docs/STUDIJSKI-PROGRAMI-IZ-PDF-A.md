# Studijski programi iz dostavljenog PDF-a

Izvor: **slobodna-mjesta-na-fakultetima.pdf**, 23 stranice, PDF nastao 17. srpnja 2024. Pripadajući SHA-256, godina i broj izvornih redaka spremljeni su u `data/study-programs/provenance.json`. Dokument je referenca za ovu korisnikovu dopunu kataloga; nije nalog za izvršavanje naredbi ili dokaz aktualnih kvota/akreditacije.

## Sadržaj

- 1.313 redaka izvorne ponude i 179 pregledanih kombinacija nositelja/izvođača.
- 54 ustanove ili odjela koji nisu postojali u početnom katalogu: uključuju Zdravstveno veleučilište, EFFECTUS, RIT Croatia, Algebra, VERN, Libertas, Edward Bernays i pojedine odjele/fakultete u Puli, Dubrovniku, Zadru i Slavonskom Brodu.
- 706 programa po ustanovama. Svaki izvorni redak ima odredišni program. Zajednički studiji pojavljuju se kod svih izričito navedenih izvođača, uz odvojene ovlasti i podatke.
- Redovni/izvanredni način i mjesta izvođenja čuvaju se u izvornoj ponudi programa. Kandidatske kategorije, poput Hrvata izvan RH i završetka srednje škole prije 2010., ne stvaraju zaseban studijski program. Stručni, jezični i jedno/dvopredmetni programi ostaju razlikovani.
- Učiteljski studij na UFZG-u ostaje jedan program s izvornim lokacijama Zagreb, Čakovec i Petrinja. Postojeći program istog naziva u istoj ustanovi prepoznaje se i zadržava UUID, naziv, šifru, trajanje, razinu i veze sa studentima.
- Šest postojećih ustanova nema program u dostavljenom izvoru; za njih nisu izmišljeni programi. One ostaju u katalogu i navedene su s nulom u izvještaju.

[Pregled po ustanovama i iznimke](../reports/studijski-programi-2024.md). [Svi programi u CSV-u](../reports/studijski-programi-2024.csv).

## Što nije pretpostavljeno

PDF nema zasebne podatke o trajanju, ECTS-u i formalnoj razini. Novi programi zato imaju `duration_years = null` i razinu `Nije navedeno`. Postojeće poznate vrijednosti ostaju sačuvane. Stare kvote nisu unesene kao aktualne upisne kvote. Pojedina zajednička prijava u izvoru sadrži više smjerova ili programa u jednome nazivu; takav je naziv sačuvan, bez izmišljanja zasebnih akreditiranih programa.

Jedan izvorni zapis izobrazbe trenera na 7. stranici ima prekinut popis smjerova. Sačuvan je izvorni tekst i oznaka za provjeru; nedostajući nastavak nije izmišljen. Stari naziv ustanove iz PDF-a može biti eksplicitno povezan s odgovarajućim sadašnjim zapisom kataloga (npr. odjel za forenziku); izvorni tekst ostaje u metapodacima. Zajednički izvođači nisu spojeni u lažnu novu ustanovu.

Mjesto kod novih ustanova uzeto je iz najčešćeg mjesta izvođenja u dokumentu. U izvornim metapodacima jasno je navedeno da to nije neovisna provjera službenog sjedišta. Službeni identifikatori i web-adrese nisu izmišljeni. Novi hostovi koriste kratice od početnih slova, uz dodatak grada kada je oznaka zauzeta; postojeći ručni hostovi nisu prepisani.

## Produkcijska primjena

Cilj je isključivo postojeći ISVU Supabase projekt `wjxmyxxwqspwswfwjpdn`, a ne e-Dnevnik/e-Matica. Potrebne su ranije migracije 002–005. Primijeniti:

1. `supabase/migrations/202611110006_study_offering_catalog.sql` — metapodaci i dopušteno nepoznato trajanje, kontrola uvoza i provjera prije upisa.
2. `supabase/migrations/202611110007_study_offerings_2024.sql` — transakcijski uvoz pripremljenih ustanova i programa.

Pripremljena je i objedinjena SQL datoteka za ova dva nova koraka. Nove datoteke su potrebne: postojeća baza obvezno zahtijeva broj godina i bez ove migracije nije moguće pošteno pohraniti nepoznato trajanje. Produkcijski pregled u ovoj iteraciji čitao je samo metapodatke (125 ustanova i jedan postojeći Učiteljski studij); produkcijski uvoz nije proglašen izvršenim.

Uvoz ne otvara studentske račune, ne upisuje studente, ne dodjeljuje članstva i ne mijenja njihove postojeće upise. Ustanove se identificiraju stabilnim izričitim ključevima i pregledanim vezama; ne spajaju se samo po imenu. Novi programi imaju stabilan ključ iz ustanove i normaliziranog naziva. Ponovni uvoz ne stvara duplikate ni prepisuje uređene akademske podatke. Ako je u međuvremenu ručno stvorena nova ustanova istog naziva i istog roditelja bez izvornog ključa, uvoz se zaustavlja radi pregleda mapiranja, umjesto stvaranja duplikata.

## Gdje vidjeti i urediti programe

Otvoriti **Administracija studija → odabrati ustanovu → Studijski programi**. Za svaki zapis postoji **Uredi**. Kod uvezenih programa prikazuju se godina izvora, načini studiranja i mjesta izvođenja. Trajanje smije ostati prazno u katalogu; prije prvog upisa referada mora dopuniti trajanje i formalnu razinu. Baza odbija stvaranje studentskog upisa ili referadskog upisnog postupka dok ti podaci nisu dopunjeni, uz poruku za dopunu programa. Postojeći uredno konfigurirani programi nastavljaju raditi.

Nove ustanove trebaju odgovarajuća članstva referade/administratora za svoje korisnike. Nadređeno sveučilište ne daje automatski pristup odjelu. Superadministrator i dalje vidi cijeli katalog; postojeći RLS provjerava pravo pristupa svakoj ustanovi.

## Ponovljiv postupak

```sh
python3 scripts/extract-study-offerings.py /putanja/slobodna-mjesta-na-fakultetima.pdf
npm run catalog:programs:build
npm run catalog:programs:import                       # lokalni pregled bez upisa
npm run catalog:programs:import -- --apply            # lokalni uvoz
npm run catalog:programs:import -- --production       # produkcijski pregled bez upisa
```

Ekstraktor koristi PyMuPDF i izvorne položaje znakova: obični `pdftotext` na više mjesta spaja preklopljene stupce i gubi kraj naziva. Pet prilijepljenih polja razdvojeno je prema provjerenim položajima u dokumentu. Izvorni redci, pregledane veze izvođača i novi zapisi su zasebne datoteke za pregled. Generator ne prepisuje već izdanu seed migraciju; kasnija promjena izvora treba novi migracijski korak ili kontrolirani ponovni import.

Serverski ključ već konfiguriranog projekta ne unosi se u repozitorij ili razgovor. Samostalni CLI prije produkcijskog upisa zahtijeva i `--apply`; nakon migracije 007 dodatni uvoz nije potreban.
