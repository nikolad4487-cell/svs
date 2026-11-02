import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ISVU · Informacijski sustav visokih ustanova",
  description: "Informacijski sustav visokih ustanova – objedinjena platforma za hrvatska visoka učilišta",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
