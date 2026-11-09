# Zoho pošta za isvu.me

ISVU korisnički račun i poštanski sandučić dvije su različite stvari. Prema tvojem odabranom paketu Zoho ima do pet sandučića. Možeš imati više ISVU korisnika; svatko tko treba stvarno primati/slati poštu mora imati vlastiti dostupni sandučić.

Za početak poveži domenu koju posjeduješ, primjerice `isvu.me`. Nemoj povezivati stvarne fakultetske domene poput `ufzg.hr`. Upute pretpostavljaju da želiš poštu oblika `admin@isvu.me`, a ne da je svih pet sandučića već otvoreno.

## 1. Dodaj i potvrdi domenu u Zohou

1. Prijavi se u **Zoho Mail Admin Console** svojim administratorskim računom.
2. Otvori **Domains → Add** i dodaj `isvu.me`, ako već nije dodana.
3. Izaberi provjeru putem **TXT zapisa**. Ostavi otvorenu stranicu s točnim nazivom i vrijednošću zapisa koje ti Zoho prikaže.
4. U Namecheapu otvori **Domain List → Manage** uz `isvu.me`.
5. Provjeri **Nameservers**. Ako domena koristi Namecheap BasicDNS, zapise dodaješ u **Advanced DNS**. Ako koristi tuđe nameservere, primjerice Cloudflare, zapise dodaješ kod tog DNS pružatelja; promjena Namecheap Advanced DNS-a tada neće imati učinka.
6. U **Advanced DNS → Host Records → Add New Record** dodaj **TXT Record**. U **Host** stavi naziv koji traži Zoho (`@` samo ako traži korijen domene), a u **Value** cijelu Zoho vrijednost. TTL može ostati Automatic.
7. Spremi zapis, vrati se u Zoho i klikni **Verify**. DNS promjene mogu trebati vremena prije nego što ih Zoho vidi.

## 2. Poveži primanje poruka — MX

1. U Zoho Admin Consoleu otvori svoju domenu i odjeljak za **Email Configuration / MX**.
2. U Namecheapu, ako on upravlja DNS-om, otvori **Advanced DNS → Mail Settings → Custom MX**.
3. Dodaj **sve MX zapise koje Zoho prikaže**, s njihovim točnim prioritetima. Za poštu `@isvu.me` Host je obično `@`, ali slijedi Zoho upute.
4. Za istu domenu ukloni/zamijeni stare MX zapise drugog pružatelja, Namecheap forwarding ili parking pošte ako ih više ne koristiš. Nemoj ostaviti dva različita aktivna sustava primanja iste domene.
5. Ne briši A, AAAA, CNAME ili Vercel verifikacijske zapise web-stranice. Pošta koristi MX; web-stranica nastavlja raditi na svojim zapisima.

Ne upisuj napamet `mx.zoho.com` ili `.eu` vrijednosti: koristi komplet koji pokazuje tvoj račun.

## 3. Poveži SPF i DKIM

1. U Zohou otvori **SPF** za svoju domenu. Kopiraj preporučenu vrijednost.
2. U DNS-u dodaj TXT zapis na traženom hostu. Ako već postoji TXT koji počinje s `v=spf1`, treba ga uskladiti s postojećim pošiljateljima; ne stvaraj drugi zasebni SPF zapis na istom hostu.
3. U Zohou otvori **DKIM**, izradi/odaberi selector i kopiraj točan host i TXT vrijednost javnog ključa.
4. Dodaj taj TXT zapis u DNS. Namecheap često sam dodaje završetak domene, pa ne treba dvaput upisati `isvu.me`.
5. Vrati se u Zoho, provjeri zapise i uključi DKIM potpisivanje kad provjera uspije.

## 4. Otvori zasebne sandučiće

U **Users → Add** izradi do broja korisnika koji tvoj paket dopušta, primjerice `admin@isvu.me`. Svakom dodijeli vlastitu lozinku i pristup; lozinke nemoj stavljati u ISVU konfiguraciju ili chat.

Alias nije novi zasebni sandučić: poruke završavaju u sandučiću kojem alias pripada. Ako učenici ne smiju vidjeti tuđu poštu, ne dijeli jedan Zoho korisnički račun među njima. Pet sandučića znači ograničenje tvojeg paketa ukupno, a ne automatski pet za svaki fakultet ili poddomenu. Provjeri podržava li tvoj paket dodatne domene/poddomene prije njihova dodavanja.

ISVU korisnička imena poput `ime.prezime@ufzg.isvu.me` mogu ostati identiteti za prijavu bez Zoho sandučića. Za njihov početni pristup koristi ispis pristupnih podataka; ne oslanjaj se na potvrdu ili oporavak poštom ako ta adresa nema pravi sandučić.

## 5. Isprobaj stvarnu poštu

Prijavi se u svaki stvoreni sandučić preko adrese koju Zoho koristi za tvoj podatkovni centar, primjerice `https://mail.zoho.eu` ili `https://mail.zoho.com`. Pošalji probnu poruku na vlastitu drugu adresu, odgovori s nje i provjeri da je odgovor stigao u pravi Zoho sandučić. Provjeri i neželjenu poštu.

## 6. Poveži ISVU tipku Webmail

1. U Vercelu otvori projekt aplikacije → **Settings → Environment Variables**.
2. Dodaj ili uredi **WEBMAIL_LOGIN_URL**.
3. Kao vrijednost stavi punu HTTPS adresu Zoho prijave koju stvarno koristiš, primjerice `https://mail.zoho.eu`. To je obična konfiguracija; ne treba unositi e-adresu, lozinku ili administratorski ključ.
4. Primijeni vrijednost za Production i pokreni novu objavu (**Redeploy** ili sljedeći GitHub push).
5. Nakon dovršetka otvori `https://isvu.me/webmail` i klikni **Otvori Webmail**. Otvara se Zoho, gdje se korisnik prijavljuje svojim Zoho podacima.

ISVU prijava ne prijavljuje automatski u Zoho. Tipka ne stvara sandučiće, ne kopira poruke u ISVU i ne zaobilazi ograničenje paketa.

## 7. Poruke prijave i resetiranja lozinke zasebna su postavka

Ako želiš da Supabase šalje poruke s tvoje domene, to se postavlja u **Supabase → Authentication → Email / SMTP Settings**. To nije `WEBMAIL_LOGIN_URL`.

Koristi točan SMTP poslužitelj, port, način šifriranja i pošiljatelja koje prikazuje Zoho za tvoj račun **ako paket dopušta SMTP za tu namjenu**. Kod uključene dvofaktorske prijave može biti potrebna zasebna aplikacijska lozinka. Tu lozinku unesi samo u Supabase SMTP postavke, ne u chat, javne `NEXT_PUBLIC_` varijable ili repozitorij. Zatim isprobaj reset lozinke na svojoj stvarnoj adresi.

Ako tvoj paket ne omogućuje potreban SMTP, poštanski sandučići i dalje mogu raditi u Zoho web-sučelju, a za automatske poruke aplikacije treba odgovarajući SMTP pružatelj.
