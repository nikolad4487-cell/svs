# Kolokviji u Studomatu

U Studomatu otvoriti **Ispiti → Kolokviji**. Pregled prikazuje kolokvije po mjesecu njihova održavanja, prema vremenskoj zoni Europe/Zagreb. Poljem **Mjesec kolokvija** moguće je ograničiti pregled, a **Svi mjeseci** vraća sve termine. Kolokviji su zasebna evidencija; ne mijenjaju završne ispite, zaključavanje rokova ili završne ocjene.

Profesor u istom prikazu otvara **Novi kolokvij**, odabire vlastiti kolegij i upisuje naziv, datum i vrijeme održavanja, rok prijave, rok odjave i broj mjesta. Dostupni su samo kolegiji kojima ima pravo upravljati. Postojeći termin može urediti ili otkazati prije početka; promjene imaju provjeru revizije kako istodobno uređivanje ne bi prepisalo tuđe izmjene. Profesor vidi prijavljene studente svojeg kolegija. Institucionalni administratori/referada imaju postojeće ovlasti upravljanja kolegijima.

Student vidi kolokvije aktivno upisanih kolegija, može odabrati **Prijavi kolokvij** ili **Odjavi kolokvij** dok odgovarajući rok traje. Ponavljanje iste prijave ne stvara duplikat. Popunjen termin odbija daljnje prijave; istodobne prijave ne mogu prekoračiti kapacitet. Otkazani i započeti termini ne prihvaćaju promjene prijave. Student ne vidi prijave drugih studenata. Sama pripadnost istoj ustanovi bez upisanog kolegija nije dovoljna za prijavu.

Kolokviji predstavljaju kontinuirano vrednovanje nastave: za prijavu se provjeravaju aktivni studij, studentsko članstvo i upisan kolegij, a ne položen završni ispit ili nacionalni uvjet. Mjesec proizlazi iz datuma koji postavi profesor; nije unaprijed ograničen na ispitne mjesece. Pri izmjeni termina studenti vide novi datum u Studomatu; automatsko slanje poruka nije uvedeno.

## Primjena

Primijeniti `supabase/migrations/202611250001_colloquia.sql` u **ISVU projektu wjxmyxxwqspwswfwjpdn**, ne u e-Matici/e-Dnevniku. Migracija dodaje tablice `colloquia` i `colloquium_registrations`, RLS i kontrolirane funkcije spremanja/prijave. Ne stvara stvarne studente, kolegije ili termine. Postojeće tablice ispita i ocjena ostaju sačuvane. Bez nove migracije samo prikaz kolokvija pokazuje uputu za postavljanje; postojeće stranice nisu ovisne o tim tablicama.

Izravno pisanje u tablice nije dopušteno aplikacijskim korisnicima. Funkcije u bazi provjeravaju stvarnog korisnika, pripadnost kolegija ustanovi, ovlasti, kapacitet i rokove; promjena skrivenog polja ili API zahtjeva ne daje pristup drugom kolegiju. Prijave i izmjene kapaciteta zaključavaju red termina. API provjerava aktivnu sesiju i izvor zahtjeva, a vrijeme iz obrasca pretvara iz hrvatskog lokalnog vremena u UTC.

## Provjere

`npm test`, `npm run typecheck`, `npm run build -- --webpack`, `npm run test:migrations`, `npm run test:colloquia`, `npm run test:exam-workflow`.

Lokalni integracijski test koristi sintetske račune i briše vlastite termine/prijave nakon provjere. Obuhvaća nastavnika, studente i drugu ustanovu, izravno pisanje, istodobne prijave posljednjeg mjesta, ponovljeni zahtjev, odjavu i oslobađanje mjesta, istek rokova, otkazivanje, reviziju te stvarni HTTP prikaz, spremanje i zabranu studentskog uređivanja/stranog Origina. Vremenske provjere uključuju prijelaz mjeseca prema Europe/Zagreb.
