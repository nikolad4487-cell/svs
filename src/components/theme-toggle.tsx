"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const active = localStorage.getItem("svs-theme") === "dark";
    setDark(active);
    document.documentElement.classList.toggle("dark", active);
  }, []);
  return (
    <button
      aria-label={dark ? "Uključi svijetli način" : "Uključi tamni način"}
      className="rounded-lg border border-slate-200 p-2"
      onClick={() => {
        document.documentElement.classList.toggle("dark", !dark);
        localStorage.setItem("svs-theme", dark ? "light" : "dark");
        setDark(!dark);
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
