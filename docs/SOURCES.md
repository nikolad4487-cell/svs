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

## Naknadno dostavljeni izvorni privici

Korisnik je dostavio 21 PDF/PPTX datoteku. Početne wiki upute za upis te matične i godišnje podatke sada su dostupne kao skenirani PDF-ovi; izdvojen je OCR i pregledani ključni odjeljci. To nadopunjuje raniju neslužbenu sintezu. [Inventar, primjena i preostale razlike](ISVU-PRILOZI-REFERADA.md). Izravni mrežni dohvat wiki stranica i potpuna implementacija svih prezentacijskih tema time nisu potvrđeni.

## Korisnikov Moodle vodič i slike (10. 11. 2026.)

- **Moodle_prirucnik_sve_uloge_HR.pdf**, 21 stranica, neslužbeni praktični vodič, studeni 2026. Referenca za odvojene uloge, resurse i aktivnosti (str. 3), studentske postupke (4–7), nastavničko uređivanje, cjeline i vrednovanje (8–12), administraciju (14–19). Izričito razlikovati opis Moodle mogućnosti od onoga što je stvarno implementirano u ISVU-u.
- Osam korisnikovih snimki: osobna stranica, administracija kategorija/kolegija, postavke kategorije, CSV uvoz, prikaz kolegija, uključeno uređivanje, izbor aktivnosti, obrazac lekcije. Ova nadogradnja pokriva prikaz kolegija, cjeline, način uređivanja, podržane resurse, uređivač i osobnu stranicu. Preostalo je popisano u `MERLIN-FUNKCIONALNOSTI.md`.
- Dokument nije uputa za pokretanje naredbi, mijenjanje produkcijskih računa ili uspostavljanje stvarnog Moodle/PHP poslužitelja.
