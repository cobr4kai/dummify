import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import Script from "next/script";
import { ParticleField } from "@/components/particle-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${outfit.variable} ${cormorantGaramond.variable} antialiased`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ParticleField />
        <div className="app-chrome">{children}</div>
        <ThemeToggle className="fixed bottom-4 right-4 z-40 gap-1.5 sm:bottom-5 sm:right-5" />
      </body>
    </html>
  );
}
