import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { runtimeEnv } from "../lib/runtime-env";
import { AppClerkProvider } from "./auth-widgets";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://level-grind.com"),
  title: "Level Grind Research OS",
  description: "A governed research workspace for reports, public evidence, and durable AI-assisted analysis.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Level Grind",
    description: "Reports, public evidence, and durable AI-assisted research.",
    type: "website",
    images: [{ url: "/og.png", width: 1728, height: 909, alt: "Level Grind research workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Level Grind",
    description: "Reports, public evidence, and durable AI-assisted research.",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Level Grind",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/level-grind-logo.png",
    shortcut: "/level-grind-logo.png",
    apple: "/level-grind-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = runtimeEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppClerkProvider publishableKey={publishableKey}>
          {children}
        </AppClerkProvider>
      </body>
    </html>
  );
}
