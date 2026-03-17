import type { Metadata } from "next";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/press-start-2p";
import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://market-witness-pyth-trial.vercel.app"),
  title: "Pyth Trade Trial",
  description: "Courtroom-style trade analysis powered by Pyth evidence.",
  openGraph: {
    title: "Pyth Trade Trial",
    description: "Put your trade on trial with Pyth-powered market evidence.",
    siteName: "Market Witness",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Pyth Trade Trial",
    description: "Put your trade on trial with Pyth-powered market evidence.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" as="image" href="/courtroom/defense.webp" type="image/webp" />
        <link rel="preload" as="image" href="/courtroom/judge.webp" type="image/webp" />
        <link rel="preload" as="image" href="/courtroom/prosecutor.webp" type="image/webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
