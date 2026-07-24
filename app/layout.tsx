import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.level-grind.com"),
  title: "Level Grind",
  description: "A private research workspace for teams that turn daily inputs into shared intelligence.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Level Grind",
    description: "Capture once. Find it everywhere.",
    type: "website",
    images: [{ url: "/og.png", width: 1728, height: 909, alt: "Level Grind research workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Level Grind",
    description: "Capture once. Find it everywhere.",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Level Grind",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
