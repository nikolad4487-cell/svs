"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="p-16">
      <h1 className="text-2xl font-bold">Došlo je do pogreške</h1>
      <p className="my-4">Pokušajte ponovno učitati stranicu.</p>
      <button
        className="rounded-lg bg-blue-700 px-5 py-3 text-white"
        onClick={reset}
      >
        Pokušaj ponovno
      </button>
    </main>
  );
}
