import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SVS · Sustav visokog obrazovanja",
  description: "Objedinjena platforma za hrvatska visoka učilišta",
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
