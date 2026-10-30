import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
export function localConfig() {
  if (existsSync(".local-supabase.json"))
    return JSON.parse(readFileSync(".local-supabase.json", "utf8"));
  return Object.fromEntries(
    execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
      }),
  );
}
