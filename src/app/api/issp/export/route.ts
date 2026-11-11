import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { isspData } from "@/lib/issp/data";
import { euro, financialSummary } from "@/lib/issp/model";
import { hrDate } from "@/lib/academic/time";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const result = await isspData(
      req.nextUrl.searchParams.get("institution") || undefined,
      req.nextUrl.searchParams.get("student") || undefined,
    );
    if (!result?.student || !result.ready)
      return new NextResponse("Evidencija nije dostupna.", { status: 404 });
    if (result.transactions.length > 20000)
      return new NextResponse(
        "Pregled je prevelik za jednu PDF datoteku. Obratite se referadi za izvoz.",
        { status: 413 },
      );
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(
      await readFile(process.cwd() + "/assets/fonts/DejaVuSans.ttf"),
      { subset: true },
    );
    let page = pdf.addPage([595, 842]),
      y = 800;
    const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, " ");
    const line = (value: string, size = 10) => {
      const words = clean(value).split(/\s+/);
      let current = "";
      const draw = (s: string) => {
        if (y < 45) {
          page = pdf.addPage([595, 842]);
          y = 800;
        }
        page.drawText(s, {
          x: 40,
          y,
          size,
          font,
          color: rgb(0.15, 0.18, 0.15),
        });
        y -= size + 7;
      };
      for (const word of words) {
        if (
          font.widthOfTextAtSize(current + (current ? " " : "") + word, size) >
            510 &&
          current
        ) {
          draw(current);
          current = "";
        }
        if (font.widthOfTextAtSize(word, size) > 510) {
          if (current) {
            draw(current);
            current = "";
          }
          let part = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(part + ch, size) > 510) {
              draw(part);
              part = "";
            }
            part += ch;
          }
          current = part;
        } else current += (current ? " " : "") + word;
      }
      if (current) draw(current);
    };
    line("ISSP — osobni računi", 18);
    line(result.data.institution.name, 12);
    const legal = result.data.studentRecords.find(
      (r) => r.student_id === result.student,
    );
    line(
      legal?.legal_name ||
        result.data.profiles.find((p) => p.id === result.student)?.full_name ||
        "Student",
      12,
    );
    line("Izrađeno: " + hrDate(new Date().toISOString()));
    line("Vlastita evidencija ISVU-a. Nije dokument državnog sustava ISSP.");
    y -= 12;
    const financial = financialSummary(result.transactions);
    for (const tx of [...result.transactions].sort((a, b) =>
      a.occurred_at.localeCompare(b.occurred_at),
    )) {
      line(
        `${hrDate(tx.occurred_at)} | ${tx.kind === "purchase" ? "Račun" : tx.kind === "allocation" ? "Dodjela" : "Storno"} | ${tx.reference}`,
        11,
      );
      line(
        `${tx.provider} | Ukupno: ${euro(tx.total_cents)} | Promjena potpore: ${euro(tx.delta_cents)}${financial.reversed.has(tx.id) ? " | STORNIRANO" : ""}`,
      );
      if (tx.description) line(tx.description);
      y -= 8;
    }
    if (!result.transactions.length) line("Nema evidentiranih osobnih računa.");
    pdf.setTitle("ISSP — osobni računi");
    pdf.setCreator("ISVU — vlastiti ISSP modul");
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=issp-osobni-racuni.pdf",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Izvoz nije dostupan. Provjerite prijavu i odabranog studenta.",
      },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
}
