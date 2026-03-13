import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { ParticleField } from "@/components/particle-field";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Abstracted",
    template: "%s | Abstracted",
  },
  icons: {
    icon: "/abstracted-favicon.svg",
    shortcut: "/abstracted-favicon.svg",
  },
  description:
    "Abstracted turns newly announced arXiv papers into punchy executive briefs for readers tracking what matters beyond the lab.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${cormorantGaramond.variable} antialiased`}>
        <ParticleField />
        <div className="app-chrome">{children}</div>
      </body>
    </html>
  );
}
