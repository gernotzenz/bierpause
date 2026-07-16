import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bierpause 🍺🚫",
  description: "Punkte-Challenge für alkoholfreie Wochen",
  manifest: "/manifest.json",
  icons: { icon: "/app.jpg", apple: "/app.jpg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bierpause",
  },
};

export const viewport: Viewport = {
  themeColor: "#F4E8CC",
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
