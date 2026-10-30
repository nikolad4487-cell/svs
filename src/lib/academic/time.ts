const zone = "Europe/Zagreb";
export function zagrebInput(iso: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function fromZagrebLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Neispravan datum.");
  const initial = Date.parse(value + "Z");
  if (!Number.isFinite(initial)) throw new Error("Neispravan datum.");
  let utc = initial;
  for (let i = 0; i < 3; i++) {
    const represented = Date.parse(
      zagrebInput(new Date(utc).toISOString()) + "Z",
    );
    utc += initial - represented;
  }
  const result = new Date(utc).toISOString();
  if (zagrebInput(result) !== value)
    throw new Error("Vrijeme ne postoji zbog promjene sata.");
  return result;
}
export function hrDate(iso: string) {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
export function weekRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
    throw new Error("Neispravan datum.");
  const day = new Date(date + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const start = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 7);
  const end = day.toISOString().slice(0, 10);
  return {
    start,
    end,
    from: fromZagrebLocal(start + "T00:00"),
    to: fromZagrebLocal(end + "T00:00"),
  };
}
