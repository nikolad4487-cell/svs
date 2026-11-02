import { z } from "zod";

const candidate = z.object({
  email: z.email().max(254), password: z.string().min(12).max(128),
  full_name: z.string().max(200).optional(), institution: z.string().max(200).optional(),
});
export type CredentialSheet = z.infer<typeof candidate>;

export function parseCredentialSheets(text: string): CredentialSheet[] {
  if (text.length > 5_000_000) throw new Error("Datoteka je prevelika (najviše 5 MB).");
  const pending = new Map<string, CredentialSheet>(), issued = new Map<string, CredentialSheet>();
  for (const line of text.split(/\r?\n/).filter((line) => line.trim())) {
    const row = JSON.parse(line);
    if (row.status === "candidate") {
      const value = candidate.parse(row);
      if (issued.has(value.email)) throw new Error("Datoteka sadrži više izdanja istog računa.");
      pending.set(value.email, value);
    } else if (row.status === "created") {
      const value = pending.get(row.email);
      if (!value || issued.has(row.email) || !z.uuid().safeParse(row.user_id).success)
        throw new Error("Potvrda računa nema odgovarajuće početne podatke.");
      issued.set(row.email, value); pending.delete(row.email);
    } else throw new Error("Datoteka nije podržani izvoz pristupnih podataka.");
  }
  if (!issued.size) throw new Error("Nema potvrđeno izrađenih računa za ispis. Nepotvrđeni pokušaji se ne ispisuju.");
  return [...issued.values()];
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
export function credentialPrintDocument(sheets: CredentialSheet[], loginUrl: string) {
  const url = new URL(loginUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Neispravna adresa prijave.");
  return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>ISVU – Podaci za prvu prijavu</title><style>
@page { size:A4; margin:20mm; } body { font:16px Arial,sans-serif; color:#111; margin:0; } section { break-after:page; page-break-after:always; } section:last-child { break-after:auto; page-break-after:auto; } h1 { font-size:24px; } dt { margin-top:24px; font-weight:bold; } dd { margin:8px 0; overflow-wrap:anywhere; } .password { font:20px monospace; white-space:pre-wrap; } .note { margin-top:36px; line-height:1.6; } footer { margin-top:48px; font-size:12px; }
</style></head><body>${sheets.map(s => `<section><p>ISVU · Informacijski sustav visokih ustanova</p><h1>Podaci za prvu prijavu</h1>${s.institution ? `<h2>${escape(s.institution)}</h2>` : ''}${s.full_name ? `<p>Ime i prezime: <strong>${escape(s.full_name)}</strong></p>` : ''}<dl><dt>Adresa prijave</dt><dd>${escape(url.toString())}</dd><dt>Korisničko ime</dt><dd>${escape(s.email)}</dd><dt>Inicijalna lozinka</dt><dd class="password">${escape(s.password)}</dd></dl><p class="note">Pri prvoj prijavi obvezno postavite vlastitu lozinku od najmanje 12 znakova. Nakon promjene ponovno se prijavite novom lozinkom.<br>Ovi podaci služe za pristup ISVU-u. Korisničko ime ne znači da je otvoren e-mail sandučić.</p><footer>Osobno i povjerljivo — uručiti samo navedenom korisniku. Ne dijelite lozinku. Ako početna lozinka više ne vrijedi, obratite se administratoru.</footer></section>`).join('')}</body></html>`;
}
