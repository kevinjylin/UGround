import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: {
    default: "UGround · Ticket alerts for the artists you follow",
    template: "%s · UGround",
  },
  description:
    "Follow artists, venues, and cities. UGround checks Ticketmaster, Songkick, and Bandsintown every day and alerts you by email, Discord, or SMS when a show is announced, a presale opens, or tickets go on sale.",
};

export const viewport: Viewport = {
  themeColor: "#121211",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
