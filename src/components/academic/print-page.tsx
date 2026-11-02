"use client";
export function PrintPage() {
  return (
    <button
      className="my-4 rounded-lg bg-blue-700 px-4 py-2 text-white print:hidden"
      onClick={() => window.print()}
    >
      Ispiši / Spremi kao PDF
    </button>
  );
}
