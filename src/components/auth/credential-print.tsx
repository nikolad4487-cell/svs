"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { credentialPrintDocument, parseCredentialSheets, type CredentialSheet } from "@/lib/admin/credential-print";

export function CredentialPrint({ loginUrl }: { loginUrl: string }) {
  const [sheets, setSheets] = useState<CredentialSheet[]>([]);
  const [error, setError] = useState("");
  const [document, setDocument] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return <section className="rounded-xl border border-slate-200 p-5">
    <h2 className="text-xl font-bold">Ispis podataka za prvu prijavu</h2>
    <p className="my-3 text-sm text-slate-500">Odaberite datoteku pristupnih podataka (.jsonl) nastalu pri uvozu novih računa. Svaki korisnik dobiva zaseban A4 list s inicijalnom lozinkom. Datoteka se obrađuje samo u ovom pregledniku i ne šalje se na poslužitelj.</p>
    <label className="block text-sm font-medium">Datoteka pristupnih podataka
      <input ref={input} type="file" accept=".jsonl" className="my-3 block w-full" onChange={async (event) => {
        const file = event.target.files?.[0]; setSheets([]); setError(""); setDocument(null);
        if (!file) return;
        try {
          if (file.size > 5_000_000) throw new Error("Datoteka je prevelika (najviše 5 MB).");
          const value = parseCredentialSheets(await file.text());
          if (input.current?.files?.[0] === file) setSheets(value);
        } catch (e) { if (input.current?.files?.[0] === file) setError("Datoteka nije ispravan izvoz potvrđeno izrađenih računa ili je prevelika (najviše 5 MB)."); }
      }} />
    </label>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    {sheets.length > 0 && <>
      <p role="status" className="my-3 text-sm">Spremno za ispis: {sheets.length} korisnika. Ispis sadrži početne lozinke iz ovog izvoza, koje nakon promjene više ne vrijede.</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => { setDocument(credentialPrintDocument(sheets, loginUrl)); }}>Ispiši / Spremi kao PDF</Button>
        <Button type="button" variant="outline" onClick={() => {setSheets([]); setDocument(null); if (input.current) input.current.value = "";}}>Ukloni podatke iz pregleda</Button>
      </div>
    </>}
    {document && <iframe title="Ispis pristupnih podataka" srcDoc={document} style={{position:"fixed",width:1,height:1,border:0,left:-10000}} onLoad={(event) => {
      const frame = event.currentTarget.contentWindow;
      if (frame) { frame.addEventListener("afterprint", () => setDocument(null), {once:true}); frame.focus(); frame.print(); }
    }} />}
  </section>;
}
