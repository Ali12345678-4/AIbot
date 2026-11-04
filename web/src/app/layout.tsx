import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", weight: ["600", "700"], display: "swap" });

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

export const viewport: Viewport = { themeColor: "#fbfbfd", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${interTight.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
