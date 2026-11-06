# Izvori nadogradnje

## Stvarno pregledano

- Dostavljeni `ISVU_veliki_vodic_i_ISVO_arhitektura.pdf`, 24 stranice: neslužbena sinteza i izvorne sheme autora. Pregledani tekst svih poglavlja; sheme nisu dokaz izgleda službenog proizvoda. Vodič izričito ne tvrdi da su otvoreni svi prezentacijski privici.
- Dostavljeni `Codex_prompt_ISVO_nadogradnja.md`: projektni prijedlog. Ranija korisnikova odluka i naknadna potvrda zadržavaju naziv ISVU umjesto ISVO i ne mijenjaju domenu.
- Repozitorij i lokalni Auth/PostgREST/PostgreSQL/Next.js testovi: potvrđuju ponašanje vlastite aplikacije, ne službenu usklađenost.

## Analogije i projektne odluke

| Funkcija | Referenca u prilogu | Klasifikacija implementacije |
| --- | --- | --- |
| Stanja roka i zaključavanje nakon svih ishoda | PDF §8; MD §3D | Analogija procesa; šest stanja i dopušteni prijelazi su projektna odluka |
| Otključavanje uz razlog | PDF §8.4; MD §3D | Projektna odluka: postojeći administrator/referada, nastavnik ostaje u svom kolegiju |
| Nedolazak odvojen od neprolazne ocjene | PDF §8.3 | Projektna odluka: outcome=absent i grade=NULL, bez ECTS-a |
| Administrativno dovršenje godišnjeg upisa | PDF §4.11–4.15; MD §3B/C | Analogija; četiri izjave referade i barem jedan stvarni upis kolegija su lokalni minimum, ne potvrda punog pravilnika ustanove |
| Zaštita povijesti | PDF §6, §16.3; MD §2 | Projektna odluka: posebne RLS tablice događaja, bez sadržaja dokumenata i feedbacka u općem auditu |
| Postojeći zapisi | Nije propisano u izvoru | Migracijska odluka: legacy oznake čuvaju raniji pristup ispitima; povijesni upis nije automatski verificiran |

## Službene poveznice za naknadnu izravnu provjeru

Njihov sadržaj **nije izravno provjeren u ovom okruženju**: wiki.srce.hr blokira trenutna mrežna politika. Navodi iz PDF-a nisu preoznačeni kao naša potvrda.

- [Početna ISVU sustava pomoći](https://wiki.srce.hr/spaces/TUT/pages/1672594/Dobro+do%C5%A1li+na+stranice+ISVU+sustava+pomo%C4%87i)
- [Prezentacije](https://wiki.srce.hr/spaces/TUT/pages/14156171/ISVU+Prezentacije)
- [Moduli i povezanost](https://wiki.srce.hr/spaces/TUT/pages/121962834/ISVU+moduli+i+njihova+povezanost)
- [Upis godine](https://wiki.srce.hr/spaces/TUT/pages/1671850/Upis+godine+na+visokom+u%C4%8Dili%C5%A1tu)
- [Ispitni rok](https://wiki.srce.hr/spaces/TUT/pages/1671930/Ispitni+rok)
- [Zaključavanje ispitnih rokova](https://wiki.srce.hr/spaces/TUT/pages/1672674/Zaklju%C4%8Davanje+ispitnih+rokova)
- [Školarine](https://wiki.srce.hr/spaces/TUT/pages/1671838/Evidencija+%C5%A1kolarine)
- [Završetak studija](https://wiki.srce.hr/spaces/TUT/pages/1671436/Zavr%C5%A1etak+studija+studenta)
- [Prijava na Studomat](https://wiki.srce.hr/spaces/TUT/pages/27689073/Prijava+na+Studomat)

Za svaku naknadno otvorenu prezentaciju zabilježiti stvarno pregledani URL, datum/verziju i relevantni slajd. Ne uvoditi nedokumentirane službene API-je ili univerzalne nacionalne pragove.
