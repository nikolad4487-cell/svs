import { supabaseConfig } from "@/lib/supabase/config";
import { identity } from "@/lib/auth/access";
import { safeModule } from "@/lib/auth/policy";
import { navigation } from "@/lib/context";
import { Field, Submit } from "./forms";
const statuses: Record<string, string> = {
  invalid: "Podaci nisu ispravni ili prijava nije uspjela.",
  unavailable:
    "Usluga trenutačno nije dostupna. Pokušajte ponovno ili se obratite administratoru.",
  expired: "Poveznica je istekla ili nije valjana. Zatražite novu.",
  "check-email":
    "Ako je zahtjev dopušten, poveznica će stići na vašu e-adresu. Provjerite i neželjenu poštu.",
  "registration-disabled":
    "Samostalna registracija nije omogućena. Obratite se administratoru ustanove.",
  "signed-out": "Odjavljeni ste.",
  "password-changed": "Lozinka je promijenjena. Ponovno se prijavite.",
  saved: "Promjene su spremljene.",
  "temporary-password": "Prije pristupa studiju promijenite dodijeljenu privremenu lozinku.",
  verified: "E-adresa je potvrđena. Postavite novu lozinku.",
};
export function ConfigNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h2 className="text-lg font-bold">Povežite Supabase</h2>
      <p className="mt-3 text-sm leading-7">
        Za prijavu postavite Supabase URL i javni publishable ključ, primijenite
        migracije te uključite pravila registracije. Upute su u dokumentu
        docs/FAZA-2.md. Bez konfiguracije nije moguć pristup korisničkim
        podacima.
      </p>
    </div>
  );
}
export async function AuthPanel({
  mode = "login",
  status = "",
  next,
}: {
  mode?: string;
  status?: string;
  next?: string;
}) {
  if (!supabaseConfig()) return <ConfigNotice />;
  const account = await identity();
  const url = await navigation();
  const target = safeModule(next);
  const selected = account?.user.app_metadata?.svs_password_change_required === true ? "password" : ["signup", "reset", "password", "account"].includes(mode)
    ? mode
    : "login";
  const authLink = (view: string) => {
    const u = new URL(url("auth"));
    u.searchParams.set("mode", view);
    u.searchParams.set("next", target);
    return u.toString();
  };
  if (account && (selected === "login" || selected === "account")) {
    const { data: sessions, error } = await account.db.rpc("list_my_sessions");
    return (
      <div className="space-y-7">
        <h2 className="text-xl font-bold">Moj račun</h2>
        {statuses[status] && (
          <p
            role="status"
            className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"
          >
            {statuses[status]}
          </p>
        )}
        <p className="text-sm text-slate-500">
          {account.user.email} · E-adresa potvrđena
        </p>
        <a
          href={url(target)}
          className="inline-block font-semibold text-blue-700"
        >
          Nastavi u modul →
        </a>
        <form
          action="/api/account/profile"
          method="post"
          className="max-w-lg space-y-4"
        >
          <Field
            label="Ime i prezime"
            name="full_name"
            defaultValue={account.profile.full_name}
            maxLength={200}
          />
          <Submit>Spremi osobne podatke</Submit>
        </form>
        <a href={authLink("password")} className="block text-sm text-blue-700">
          Promijeni lozinku
        </a>
        <section>
          <h3 className="mb-4 font-bold">Aktivne sesije</h3>
          {error ? (
            <p>Popis sesija nije dostupan.</p>
          ) : (
            <div className="space-y-3">
              {sessions?.map(
                (s: {
                  id: string;
                  created_at: string;
                  user_agent: string | null;
                  current_session: boolean;
                }) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {s.current_session
                          ? "Trenutačna sesija"
                          : "Drugi uređaj"}
                      </p>
                      <p className="mt-1 max-w-xl break-words text-xs text-slate-500">
                        {s.user_agent || "Nepoznat preglednik"} ·{" "}
                        {new Date(s.created_at).toLocaleString("hr-HR", {
                          timeZone: "Europe/Zagreb",
                        })}
                      </p>
                    </div>
                    <form action="/api/account/revoke-session" method="post">
                      <input type="hidden" name="session_id" value={s.id} />
                      <Submit>Opozovi sesiju</Submit>
                    </form>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
        <div className="flex flex-wrap gap-4">
          {["local", "global"].map((scope) => (
            <form key={scope} action="/api/auth/logout" method="post">
              <input type="hidden" name="scope" value={scope} />
              <Submit>
                {scope === "local"
                  ? "Odjava ove sesije"
                  : "Odjava svih uređaja"}
              </Submit>
            </form>
          ))}
        </div>
      </div>
    );
  }
  if (selected === "password" && !account)
    return (
      <div className="space-y-4">
        <p>
          Za novu lozinku otvorite poveznicu za oporavak iz e-pošte ili se
          prijavite.
        </p>
        <a href={authLink("reset")} className="text-blue-700">
          Zatraži novu poveznicu
        </a>
      </div>
    );
  const titles = {
    login: "Dobro došli u SVS",
    signup: "Registracija po pozivu",
    reset: "Zaboravljena lozinka",
    password: "Postavite novu lozinku",
    account: "Moj račun",
  };
  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold">
        {titles[selected as keyof typeof titles]}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        {selected === "signup"
          ? "Registrirati se mogu samo pozvane adrese s dopuštene domene ustanove. Potvrda e-pošte je obavezna."
          : "Koristite svoj akademski korisnički račun."}
      </p>
      {statuses[status] && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900"
        >
          {statuses[status]}
        </p>
      )}
      <form
        method="post"
        action={`/api/auth/${selected === "account" ? "login" : selected}`}
        className="mt-7 space-y-5"
      >
        <input type="hidden" name="next" value={target} />
        {selected === "signup" && (
          <Field
            label="Ime i prezime"
            name="full_name"
            autoComplete="name"
            minLength={2}
            maxLength={200}
          />
        )}{" "}
        {selected !== "password" && (
          <Field
            label="E-adresa"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
          />
        )}{" "}
        {selected !== "reset" && (
          <Field
            label="Lozinka"
            name="password"
            type="password"
            minLength={selected === "login" ? 1 : 12}
            maxLength={128}
            autoComplete={
              selected === "login" ? "current-password" : "new-password"
            }
          />
        )}
        <Submit>
          {selected === "login"
            ? "Prijavi se"
            : selected === "signup"
              ? "Registriraj račun"
              : selected === "reset"
                ? "Pošalji poveznicu"
                : "Spremi novu lozinku"}
        </Submit>
      </form>
      <nav className="mt-7 flex flex-wrap gap-5 text-sm text-blue-700">
        <a href={authLink("login")}>Prijava</a>
        <a href={authLink("reset")}>Resetiranje lozinke</a>
        {process.env.AUTH_INVITE_SIGNUP_ENABLED === "true" && (
          <a href={authLink("signup")}>Imam poziv za registraciju</a>
        )}
      </nav>
    </div>
  );
}
