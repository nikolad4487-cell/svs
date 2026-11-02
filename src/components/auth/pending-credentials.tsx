"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { credentialPrintDocument, type CredentialSheet } from "@/lib/admin/credential-print";

export function PendingCredentials({ inviteId }: { inviteId: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{sheet: CredentialSheet; loginUrl: string; userId: string} | null>(null);
  const [document, setDocument] = useState<string | null>(null);
  return <div className="my-3 rounded-lg border border-slate-200 p-3 text-sm">
    {!issued ? <>
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />
        <span>Potvrđujem identitet korisnika i želim aktivirati račun bez e-pošte te dodijeliti novu inicijalnu lozinku. Stara lozinka korisnika na čekanju više neće vrijediti.</span></label>
      <Button className="mt-3" type="button" disabled={!confirmed || busy} onClick={async () => {
        setBusy(true); setError("");
        try {
          const response = await fetch("/api/admin/pending-credentials", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invite_id: inviteId, activate: true }), cache: "no-store" });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Izdavanje nije uspjelo.");
          setIssued(data);
        } catch (e) { setError(e instanceof Error ? e.message : "Provjerite stanje računa prije novog pokušaja."); }
        finally { setBusy(false); }
      }}>{busy ? "Pripremam podatke…" : "Izradi početne podatke i ispiši"}</Button>
    </> : <>
      <p>Račun je aktiviran. Spremite ili ispišite list prije napuštanja stranice. Korisnik mora promijeniti inicijalnu lozinku pri prvoj prijavi.</p>
      <Button className="mt-3" type="button" onClick={() => setDocument(credentialPrintDocument([issued.sheet], issued.loginUrl))}>Ispiši / Spremi kao PDF</Button>
      <Button className="mt-3 ml-2" type="button" variant="outline" onClick={() => {
        const blob = new Blob([JSON.stringify({status:"candidate",...issued.sheet})+"\n"+JSON.stringify({status:"created",email:issued.sheet.email,user_id:issued.userId})+"\n"], {type:"application/x-ndjson"});
        const url = URL.createObjectURL(blob), a = window.document.createElement("a"); a.href=url; a.download="pocetni-podaci.jsonl"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      }}>Preuzmi za ponovni ispis</Button>
    </>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {document && <iframe title="Početni podaci za prijavu" srcDoc={document} style={{position:"fixed",width:1,height:1,border:0,left:-10000}} onLoad={e => {
      const frame=e.currentTarget.contentWindow;
      if(frame) {frame.addEventListener("afterprint",()=>setDocument(null),{once:true});frame.focus();frame.print();}
    }} />}
  </div>;
}
