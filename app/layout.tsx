import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bierpause 🍺🚫",
  description: "Punkte-Challenge für alkoholfreie Wochen",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
