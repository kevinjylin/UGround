import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif, Barlow } from "next/font/google";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const barlow = Barlow({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UGround · Catch the show before the feed wakes up",
  description:
    "Watchlist-powered presale alerts. UGround watches Ticketmaster, Eventbrite, Songkick, AXS & more — and pings you the second a date drops, a status flips, or a presale opens.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${barlow.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
