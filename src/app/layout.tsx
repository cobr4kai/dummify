import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
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
      <body className={`${manrope.variable} ${newsreader.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
