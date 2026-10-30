import { requireIdentity } from "@/lib/auth/access";
import { roles, roleNames } from "@/lib/auth/policy";
import { Field, Submit, inputClass } from "./forms";
export async function Institutions({
  system = false,
  status,
}: {
  system?: boolean;
  status?: string;
}) {
  const account = await requireIdentity(system ? "admin" : undefined);
  const { data: institutions, error } = await account.db
    .from("institutions")
    .select("*")
    .order("name");
  if (error) throw new Error("Ustanove nisu dostupne.");
  const { data: memberships, error: membersError } = await account.db
    .from("memberships")
    .select("institution_id,user_id,role");
  if (membersError) throw new Error("Članstva nisu dostupna.");
  const { data: profiles } = await account.db
    .from("profiles")
    .select("id,full_name");
  const { data: invites } = await account.db
    .from("registration_invites")
    .select("id,email,institution_id,role,expires_at,accepted_at");
  const { data: logs } = await account.db
    .from("audit_logs")
    .select("id,action,created_at,institution_id")
    .order("created_at", { ascending: false })
    .limit(20);
  const fields = (institution?: {
    name: string;
    code: string;
    headquarters: string;
    contact_email: string | null;
  }) => (
    <>
      <Field
        label="Naziv ustanove"
        name="name"
        defaultValue={institution?.name}
        maxLength={200}
      />
      <Field
        label="Kratica (velika slova, brojevi i -)"
        name="code"
        defaultValue={institution?.code}
        maxLength={20}
      />
      <Field
        label="Sjedište"
        name="headquarters"
        defaultValue={institution?.headquarters}
        required={false}
        maxLength={200}
      />
      <Field
        label="Kontakt e-adresa"
        name="contact_email"
        type="email"
        defaultValue={institution?.contact_email || ""}
        required={false}
      />
    </>
  );
  return (
    <div className="space-y-8">
      {status && (
        <p
          role="status"
          className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"
        >
          {status === "saved"
            ? "Promjene su spremljene."
            : "Podaci nisu spremljeni. Provjerite obrazac, ovlasti i jedinstvenu kraticu."}
        </p>
      )}
      <div>
        <h2 className="text-xl font-bold">
          {system ? "Ustanove i korisničke ovlasti" : "Moje ustanove"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {account.superadmin
            ? "Superadministrator sustava"
            : "Prikazana su članstva i ustanove kojima imate pristup."}
        </p>
      </div>
      {account.superadmin && (
        <details className="rounded-xl border border-slate-200 p-5">
          <summary className="cursor-pointer font-semibold">
            Dodaj visoko učilište
          </summary>
          <form
            method="post"
            action="/api/admin/institution"
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            {fields()}
            <Submit>Dodaj ustanovu</Submit>
          </form>
        </details>
      )}
      {institutions?.length === 0 && (
        <p>Nemate aktivnih članstava. Obratite se administratoru ustanove.</p>
      )}
      {institutions?.map((i) => {
        const manager =
          account.superadmin ||
          account.memberships.some(
            (m) => m.institution_id === i.id && m.role === "institution_admin",
          );
        return (
          <article
            key={i.id}
            className="rounded-xl border border-slate-200 p-5"
          >
            <h3 className="text-lg font-bold">
              {i.name}{" "}
              <span className="text-sm font-normal text-slate-500">
                {i.code}
              </span>
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {i.headquarters} {i.contact_email}{" "}
              {!i.active && "· Neaktivna ustanova"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {account.memberships
                .filter((m) => m.institution_id === i.id)
                .map((m) => (
                  <span
                    key={m.role}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
                  >
                    {roleNames[m.role]}
                  </span>
                ))}
            </div>
            {manager && (
              <>
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                    Uredi ustanovu
                  </summary>
                  <form
                    action="/api/admin/institution"
                    method="post"
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <input name="institution_id" type="hidden" value={i.id} />
                    {fields(i)}
                    <Submit>Spremi ustanovu</Submit>
                  </form>
                </details>
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                    Pozovi korisnika
                  </summary>
                  <p className="mt-3 text-xs leading-6 text-slate-500">
                    Poziv dopušta registraciju navedene adrese 7 dana. Poveznicu
                    na prijavu podijelite s korisnikom; ovaj obrazac ne šalje
                    e-poštu. Postojeći korisnik treba se ponovno prijaviti da
                    prihvati poziv.
                  </p>
                  <form
                    action="/api/admin/invite"
                    method="post"
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <input type="hidden" name="institution_id" value={i.id} />
                    <Field label="E-adresa" name="email" type="email" />
                    <label className="text-sm">
                      Uloga
                      <select name="role" className={inputClass}>
                        {roles
                          .filter(
                            (r) =>
                              account.superadmin || r !== "institution_admin",
                          )
                          .map((r) => (
                            <option key={r} value={r}>
                              {roleNames[r]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Submit>Spremi poziv</Submit>
                  </form>
                </details>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="mb-3 text-left font-semibold">
                      Članovi ustanove
                    </caption>
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-2">Korisnik</th>
                        <th>Uloga</th>
                        {account.superadmin && <th>Radnja</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {memberships
                        ?.filter((m) => m.institution_id === i.id)
                        .map((m) => (
                          <tr
                            key={`${m.user_id}-${m.role}`}
                            className="border-t border-slate-200"
                          >
                            <td className="py-3">
                              {profiles?.find((p) => p.id === m.user_id)
                                ?.full_name || m.user_id}
                            </td>
                            <td>
                              {roleNames[m.role as keyof typeof roleNames]}
                            </td>
                            {account.superadmin && (
                              <td>
                                <form
                                  action="/api/admin/membership"
                                  method="post"
                                >
                                  <input
                                    name="institution_id"
                                    type="hidden"
                                    value={i.id}
                                  />
                                  <input
                                    name="user_id"
                                    type="hidden"
                                    value={m.user_id}
                                  />
                                  <input
                                    name="role"
                                    type="hidden"
                                    value={m.role}
                                  />
                                  <input
                                    name="operation"
                                    type="hidden"
                                    value="remove"
                                  />
                                  <button className="text-red-700">
                                    Ukloni ulogu
                                  </button>
                                </form>
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm">
                    Registracijski pozivi
                  </summary>
                  <ul className="mt-3 space-y-2 text-xs text-slate-500">
                    {invites
                      ?.filter((v) => v.institution_id === i.id)
                      .map((v) => (
                        <li key={v.id}>
                          {v.email} ·{" "}
                          {roleNames[v.role as keyof typeof roleNames]} ·{" "}
                          {v.accepted_at
                            ? "Prihvaćen"
                            : new Date(v.expires_at) < new Date()
                              ? "Istekao"
                              : "Na čekanju"}
                        </li>
                      ))}
                  </ul>
                </details>
              </>
            )}
            {account.superadmin && (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-blue-700">
                  Dodijeli ulogu postojećem korisniku
                </summary>
                <form
                  action="/api/admin/membership"
                  method="post"
                  className="mt-4 space-y-4"
                >
                  <input name="institution_id" type="hidden" value={i.id} />
                  <label className="block text-sm">
                    Korisnik
                    <select name="user_id" className={inputClass} required>
                      {profiles?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Uloga
                    <select name="role" className={inputClass}>
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {roleNames[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Submit>Dodijeli ulogu</Submit>
                </form>
              </details>
            )}
          </article>
        );
      })}
      <details className="rounded-xl border border-slate-200 p-5">
        <summary className="cursor-pointer font-semibold">
          Evidencija administrativnih radnji
        </summary>
        <ul className="mt-4 space-y-2 text-xs text-slate-500">
          {logs?.map((l) => (
            <li key={l.id}>
              {l.action} ·{" "}
              {new Date(l.created_at).toLocaleString("hr-HR", {
                timeZone: "Europe/Zagreb",
              })}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
