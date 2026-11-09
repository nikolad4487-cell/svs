import { ExternalLink } from "lucide-react";
import { serviceLoginUrl } from "@/lib/external-services";
import { Button } from "@/components/ui/button";

export function ExternalService({
  module,
  administrator,
}: {
  module: "merlin" | "webmail";
  administrator: boolean;
}) {
  const mail = module === "webmail";
  const configured = mail
    ? process.env.WEBMAIL_LOGIN_URL
    : process.env.MERLIN_LMS_URL;
  const target = serviceLoginUrl(configured);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">
        {target
          ? mail
            ? "Pristup poštanskom sandučiću"
            : "Pristup e-učenju"
          : mail
            ? "Poštanski servis još nije povezan"
            : "E-učenje još nije povezano"}
      </h2>
      <p className="max-w-2xl text-sm leading-7 text-slate-600">
        {mail
          ? "ISVU korisnički račun i adresa za prijavu sami ne stvaraju poštanski sandučić. Za slanje i primanje poruka ustanova mora otvoriti sandučić kod pružatelja e-pošte."
          : "Nastavni materijali, zadaci i kvizovi još nisu izvedeni unutar ISVU-a. Ako ustanova koristi zaseban sustav e-učenja, ovdje se može otvoriti njegova prijava."}
      </p>
      {target ? (
        <>
          <Button asChild>
            <a href={target} target="_blank" rel="noopener noreferrer">
              {mail ? "Otvori Webmail" : "Otvori sustav e-učenja"}{" "}
              <ExternalLink size={16} />
            </a>
          </Button>
          <p className="text-sm text-slate-500">
            Otvara se {new URL(target).hostname}. Prijavite se podacima koje vam
            je ustanova dodijelila za tu uslugu. ISVU prijava ne prijavljuje vas
            automatski u vanjsku uslugu.
          </p>
        </>
      ) : (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {configured
            ? "Adresa usluge nije ispravna. Administrator treba provjeriti postavke povezivanja."
            : "Ustanova još nije postavila adresu usluge. Za pristup obratite se administratoru ustanove."}
        </p>
      )}
      {administrator && (
        <details className="rounded-lg border border-slate-200 p-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            Upute za administratora
          </summary>
          <p className="mt-3 leading-6">
            {mail
              ? "Najprije aktivirajte poštansku domenu i zasebne sandučiće kod odabranog pružatelja. Zatim u postavkama Vercel projekta dodajte WEBMAIL_LOGIN_URL s punom HTTPS adresom prijave pružatelja i pokrenite novu objavu."
              : "Ako već imate Moodle ili drugi sustav e-učenja, u postavkama Vercel projekta dodajte MERLIN_LMS_URL s punom HTTPS adresom njegove prijave i pokrenite novu objavu. To povezuje pristupnu tipku; sinkronizacija kolegija, računa i jedinstvena prijava zahtijevaju zasebnu integraciju."}
          </p>
        </details>
      )}
    </section>
  );
}
