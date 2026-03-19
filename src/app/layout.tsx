import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import Script from "next/script";
import { ParticleField } from "@/components/particle-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: "Abstracted | AI research explained in plain English",
  icons: {
    icon: "/abstracted-favicon.svg",
    shortcut: "/abstracted-favicon.svg",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
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
        <ThemeToggle className="hidden gap-1.5 sm:fixed sm:bottom-5 sm:right-5 sm:z-40 sm:inline-flex" />
      </body>
    </html>
  );
}
