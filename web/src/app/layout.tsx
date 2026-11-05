import type { Metadata, Viewport } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm", weight: ["400", "600"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "K444AXN Driving School | Driving Lessons & Online Booking", template: "%s | K444AXN Driving School" },
  description: "Patient, professional driving lessons with K444AXN Driving School. See lesson prices and book your driving lesson online in minutes.",
  applicationName: "K444AXN Driving School",
  keywords: ["driving lessons", "driving school", "driving instructor", "learn to drive", "book driving lessons online", "test preparation", "refresher driving lessons"],
  openGraph: { type: "website", siteName: "K444AXN Driving School", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${archivo.variable} ${mono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
